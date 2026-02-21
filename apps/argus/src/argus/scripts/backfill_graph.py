#!/usr/bin/env python3
"""
Backfill script to process existing events and add them to the knowledge graph.

This script:
1. Fetches all existing events from Supabase
2. Extracts entities and relationships from event text
3. Generates embeddings for entities and events
4. Creates/updates nodes, edges, and event-entity links

Usage:
    cd /home/james/argus
    source venv/bin/activate
    python scripts/backfill_graph.py                    # Process all events
    python scripts/backfill_graph.py --limit 10        # Process 10 events  
    python scripts/backfill_graph.py --dry-run         # Preview without changes
    python scripts/backfill_graph.py --skip-existing   # Skip events with embeddings
"""

import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

# Add argus root to path
argus_root = Path(__file__).parent.parent
sys.path.insert(0, str(argus_root))
os.chdir(argus_root)

from dotenv import load_dotenv
load_dotenv()

import numpy as np
from google import genai
from google.genai import types
from supabase import create_client


# ============================================================================
# Embedding Generation (self-contained, no relative imports)
# ============================================================================

def normalize_embedding(embedding: list[float]) -> list[float]:
    """L2 normalize an embedding vector."""
    arr = np.array(embedding, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    return arr.tolist()


async def generate_embedding(
    client: genai.Client,
    text: str,
    task_type: str = "SEMANTIC_SIMILARITY",
    dimensions: int = 3072
) -> list[float]:
    """Generate embedding for text."""
    result = await asyncio.to_thread(
        client.models.embed_content,
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            task_type=task_type,
            output_dimensionality=dimensions
        )
    )
    
    if result.embeddings and len(result.embeddings) > 0:
        return normalize_embedding(result.embeddings[0].values)
    
    raise ValueError("No embedding returned")


async def generate_batch_embeddings(
    client: genai.Client,
    texts: list[str],
    task_type: str = "SEMANTIC_SIMILARITY",
    dimensions: int = 3072
) -> list[list[float]]:
    """Generate embeddings for multiple texts."""
    embeddings = []
    for text in texts:
        try:
            emb = await generate_embedding(client, text, task_type, dimensions)
            embeddings.append(emb)
        except Exception as e:
            print(f"      ⚠️ Embedding failed for '{text[:30]}...': {e}")
            embeddings.append(None)
    return embeddings


# ============================================================================
# Entity Resolution (self-contained)
# ============================================================================

def normalize_entity_name(name: str) -> str:
    """Normalize entity name for matching."""
    name = name.lower().strip()
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', '_', name)
    name = re.sub(r'_+', '_', name)
    name = name.strip('_')
    return name


async def resolve_entity(
    db,
    name: str,
    entity_type: str,
    embedding: list[float] | None
) -> str:
    """
    Two-pass entity resolution:
    1. Fast alias lookup
    2. Semantic search (if alias lookup fails)
    """
    normalized = normalize_entity_name(name)
    
    # Pass 1: Alias lookup
    result = db.table("entity_aliases").select("canonical_id").eq(
        "alias", normalized
    ).execute()
    
    if result.data and len(result.data) > 0:
        return result.data[0]["canonical_id"]
    
    # Pass 2: Semantic search
    if embedding:
        try:
            result = db.rpc("search_entities_by_embedding", {
                "query_embedding": embedding,
                "entity_type_filter": entity_type,
                "match_threshold": 0.15,
                "match_count": 1
            }).execute()
            
            if result.data and len(result.data) > 0:
                match = result.data[0]
                if match.get("similarity", 0) >= 0.92:
                    # Auto-merge: add alias
                    try:
                        db.table("entity_aliases").insert({
                            "alias": normalized,
                            "canonical_id": match["id"]
                        }).execute()
                    except:
                        pass  # Alias might already exist
                    return match["id"]
        except Exception as e:
            print(f"      ⚠️ Semantic search failed: {e}")
    
    # Create new entity node
    result = db.table("nodes").insert({
        "name": name,
        "node_type": entity_type,
        "embedding": embedding,
        "source": "llm"
    }).execute()
    
    if result.data and len(result.data) > 0:
        new_id = result.data[0]["id"]
        # Add alias for future lookups
        try:
            db.table("entity_aliases").insert({
                "alias": normalized,
                "canonical_id": new_id
            }).execute()
        except:
            pass
        return new_id
    
    raise ValueError(f"Failed to create entity: {name}")


# ============================================================================
# Edge Operations (self-contained)
# ============================================================================

async def upsert_edge(
    db,
    source_id: str,
    target_id: str,
    relation_type: str,
    percentage: float | None = None,
    confidence: float = 0.6,
    polarity: float = 0.0,
    detail: str | None = None
) -> str:
    """Create or update an edge, and increment target node's hit_count."""
    # Check if edge exists
    result = db.table("edges").select("id, hit_count").eq(
        "source_id", source_id
    ).eq("target_id", target_id).eq("relation_type", relation_type).execute()
    
    if result.data and len(result.data) > 0:
        # Update existing edge
        edge = result.data[0]
        db.table("edges").update({
            "hit_count": edge["hit_count"] + 1,
            "last_confirmed": "NOW()",
            "confidence": max(edge.get("confidence", 0), confidence),
        }).eq("id", edge["id"]).execute()
        edge_id = edge["id"]
    else:
        # Create new edge
        result = db.table("edges").insert({
            "source_id": source_id,
            "target_id": target_id,
            "relation_type": relation_type,
            "percentage": percentage,
            "confidence": confidence,
            "polarity": polarity,
            "reasoning": detail,
            "source": "llm"
        }).execute()
        
        if not result.data or len(result.data) == 0:
            raise ValueError("Failed to create edge")
        edge_id = result.data[0]["id"]
    
    # Increment target node's hit_count (how many events reference this entity)
    # Only for event-entity edges (involves, affects, occurred_in, mentions)
    if relation_type in ("involves", "affects", "occurred_in", "mentions"):
        try:
            # Get current hit_count
            node = db.table("nodes").select("hit_count").eq("id", target_id).execute()
            if node.data and len(node.data) > 0:
                current = node.data[0].get("hit_count") or 0
                db.table("nodes").update({
                    "hit_count": current + 1
                }).eq("id", target_id).execute()
        except Exception:
            pass  # Don't fail if hit_count update fails
    
    return edge_id


async def update_event_embedding(db, event_id: str, embedding: list[float]) -> None:
    """Update embedding for an event node."""
    db.table("nodes").update({
        "embedding": embedding,
        "updated_at": "NOW()"
    }).eq("id", event_id).eq("node_type", "event").execute()


# ============================================================================
# Main Backfill Logic
# ============================================================================

async def fetch_events(db, limit: int | None = None, skip_existing: bool = False) -> list[dict]:
    """Fetch events from Supabase."""
    # Query the events view
    query = db.table("events").select("*").order("timestamp", desc=True)
    
    if limit:
        query = query.limit(limit)
    
    result = query.execute()
    events = result.data if result.data else []
    
    if skip_existing and events:
        # Filter out events that already have embeddings
        # Process in batches to avoid query size limits
        has_embedding = set()
        event_ids = [e["id"] for e in events]
        batch_size = 100
        
        for i in range(0, len(event_ids), batch_size):
            batch_ids = event_ids[i:i + batch_size]
            try:
                nodes_result = db.table("nodes").select("id").in_("id", batch_ids).not_.is_("embedding", "null").execute()
                has_embedding.update(n["id"] for n in (nodes_result.data or []))
            except Exception:
                pass  # If query fails, don't filter
        
        events = [e for e in events if e["id"] not in has_embedding]
    
    return events


async def extract_entities_from_event(
    client: genai.Client,
    event: dict,
    model: str
) -> list[dict]:
    """
    Extract named entities from event text.
    
    Returns only entities with specific names - no generic descriptions.
    Relationships are NOT extracted (they emerge from co-occurrence).
    """
    title = event.get("title", "")
    summary = event.get("summary", "")
    sources = event.get("sources", [])
    
    # Build source headlines
    source_text = ""
    if sources:
        headlines = [s.get("headline", "") for s in sources[:5] if isinstance(s, dict)]
        source_text = "\n".join(f"- {h}" for h in headlines if h)
    
    event_text = f"""Event: {title}

Summary: {summary}

Source Headlines:
{source_text}"""

    prompt = """Extract ONLY specifically named entities from this geopolitical event.

STRICT RULES:
- Only extract entities with proper names (e.g., "Apple Inc", "Xi Jinping", "United States")
- Do NOT extract generic descriptions (e.g., "tech companies", "Western powers", "officials")
- If you cannot identify a specific name, do NOT create an entity
- Each entity must have a clear, unambiguous name

ENTITY TYPES (only use these):
- country: Specific nation (e.g., "China", "United States", "Germany")
- company: Named corporation (e.g., "TSMC", "Apple Inc", "Gazprom")
- leader: Named person with political/corporate power (e.g., "Xi Jinping", "Elon Musk")
- organization: Named org (e.g., "United Nations", "NATO", "WHO")
- facility: Named place (e.g., "Panama Canal", "Strait of Hormuz", "Port of Shanghai")
- chokepoint: Strategic passage (e.g., "Taiwan Strait", "Suez Canal")
- commodity: Specific resource (e.g., "crude oil", "lithium", "wheat")
- product: Specific product category (e.g., "semiconductors", "LNG", "rare earths")
- weapon_system: Named military equipment (e.g., "F-35", "S-400", "Patriot missile")
- alliance: Named alliance (e.g., "NATO", "BRICS", "European Union", "AUKUS")

ROLES (assign one per entity):
- actor: The entity taking action in this event
- affected: The entity being impacted by this event
- location: Where this event occurred
- mentioned: Referenced but not central to the event

Return JSON:
{
  "entities": [
    {"name": "United States", "type": "country", "role": "actor"},
    {"name": "Xi Jinping", "type": "leader", "role": "mentioned"}
  ]
}

Be conservative - fewer high-quality entities is better than many questionable ones."""

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=model,
            contents=f"{prompt}\n\n{event_text}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        
        if response.text:
            result = json.loads(response.text)
            return result.get("entities", [])
    
    except Exception as e:
        print(f"      ⚠️ Entity extraction failed: {e}")
    
    return []


async def process_event(
    event: dict,
    gemini_client: genai.Client,
    db,
    model: str,
    dry_run: bool = False
) -> bool:
    """
    Process a single event for the knowledge graph.
    
    Event-centric approach:
    - Extract named entities only (strict)
    - Create event-entity edges (involves, affects, occurred_in)
    - NO entity-entity edges (these emerge from co-occurrence)
    """
    event_id = event.get("id")
    title = event.get("title", "Unknown")[:60]
    
    print(f"\n🔗 Processing '{title}...'")
    
    # Step 1: Extract named entities (no relationships)
    print("   📝 Extracting entities...")
    entities = await extract_entities_from_event(gemini_client, event, model)
    
    if not entities:
        print("   ⚠️ No entities extracted")
    else:
        print(f"   ✓ Found {len(entities)} entities")
    
    if dry_run:
        for e in entities[:8]:
            print(f"      - {e.get('name')} ({e.get('type')}): {e.get('role')}")
        return True
    
    # Step 2: Generate embeddings & resolve entities to canonical nodes
    resolved_entities = {}  # name -> UUID
    entity_roles = {}  # UUID -> role
    
    if entities:
        print("   🧮 Generating embeddings...")
        entity_texts = [e.get("name", "") for e in entities]
        embeddings = await generate_batch_embeddings(gemini_client, entity_texts)
        
        print("   🔍 Resolving entities...")
        for entity, embedding in zip(entities, embeddings):
            try:
                entity_name = entity.get("name", "")
                entity_type = entity.get("type", "organization")
                entity_role = entity.get("role", "mentioned")
                
                entity_uuid = await resolve_entity(db, entity_name, entity_type, embedding)
                resolved_entities[entity_name] = entity_uuid
                entity_roles[entity_uuid] = entity_role
            except Exception as e:
                print(f"      ⚠️ Failed to resolve '{entity.get('name')}': {e}")
        
        print(f"   ✓ Resolved {len(resolved_entities)} entities")
    
    # Step 3: Create event-entity edges (role-based)
    # These are the primary structure - entity-entity relationships
    # will emerge from co-occurrence analysis later
    if resolved_entities:
        role_to_relation = {
            "actor": "involves",
            "affected": "affects", 
            "location": "occurred_in",
            "mentioned": "mentions"
        }
        
        edges_created = 0
        for entity_name, entity_uuid in resolved_entities.items():
            role = entity_roles.get(entity_uuid, "mentioned")
            relation_type = role_to_relation.get(role, "involves")
            try:
                await upsert_edge(db, event_id, entity_uuid, relation_type, confidence=0.7)
                edges_created += 1
            except Exception as e:
                print(f"      ⚠️ Event link failed: {e}")
        
        print(f"   ✓ Linked event → {edges_created} entities")
    
    # Step 4: Generate event embedding for semantic search
    print("   🎯 Generating event embedding...")
    try:
        event_text = f"{event.get('title', '')} {event.get('summary', '')}"
        event_embedding = await generate_embedding(
            gemini_client, event_text,
            task_type="RETRIEVAL_DOCUMENT",
            dimensions=3072
        )
        await update_event_embedding(db, event_id, event_embedding)
        print("   ✓ Updated event embedding")
    except Exception as e:
        print(f"   ⚠️ Event embedding failed: {e}")
    
    return True


async def main():
    parser = argparse.ArgumentParser(description="Backfill knowledge graph from existing events")
    parser.add_argument("--limit", type=int, help="Limit number of events to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    parser.add_argument("--skip-existing", action="store_true", help="Skip events with embeddings")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🌐 ARGUS GRAPH BACKFILL")
    print("=" * 60)
    
    # Validate environment
    gemini_key = os.getenv("GEMINI_API_KEY")
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    model = os.getenv("MODEL_ENRICHMENT", "gemini-2.5-flash")
    
    if not all([gemini_key, supabase_url, supabase_key]):
        print("❌ Missing required environment variables:")
        if not gemini_key:
            print("   - GEMINI_API_KEY")
        if not supabase_url:
            print("   - NEXT_PUBLIC_SUPABASE_URL")
        if not supabase_key:
            print("   - SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - No changes will be made")
    
    # Initialize clients
    print("\n📡 Connecting to services...")
    gemini_client = genai.Client(api_key=gemini_key)
    db = create_client(supabase_url, supabase_key)
    print(f"   ✓ Connected (model: {model})")
    
    # Fetch events
    print("\n📥 Fetching events...")
    events = await fetch_events(db, limit=args.limit, skip_existing=args.skip_existing)
    print(f"   ✓ Found {len(events)} events to process")
    
    if not events:
        print("\n✅ No events to process")
        return
    
    # Process events
    print(f"\n🚀 Processing {len(events)} events...")
    success_count = 0
    error_count = 0
    
    for i, event in enumerate(events, 1):
        print(f"\n[{i}/{len(events)}]", end="")
        try:
            success = await process_event(event, gemini_client, db, model, dry_run=args.dry_run)
            if success:
                success_count += 1
        except Exception as e:
            print(f"   ❌ Error: {e}")
            error_count += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 BACKFILL COMPLETE")
    print("=" * 60)
    print(f"   ✅ Successful: {success_count}")
    print(f"   ❌ Errors: {error_count}")
    print(f"   📅 Completed: {datetime.now().isoformat()}")
    
    if args.dry_run:
        print("\n   ⚠️ This was a dry run - no changes were made")


if __name__ == "__main__":
    asyncio.run(main())
