#!/usr/bin/env python3
"""
Sync events from R2 to Supabase with full pipeline processing.

This bridges the old R2-based production flow with the new Supabase/Atlas system.
Runs the same processing as main.py: graph processing, causal linking, etc.

Usage:
    python scripts/sync_from_r2.py              # Sync all new events
    python scripts/sync_from_r2.py --dry-run    # Preview what would sync
    python scripts/sync_from_r2.py --no-graph   # Sync without graph processing
    python scripts/sync_from_r2.py --no-causal  # Sync without causal linking
"""

import asyncio
import argparse
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv

load_dotenv()


def get_r2_client():
    """Get boto3 client for R2."""
    import boto3
    
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto"
    )


def get_supabase_client():
    """Get Supabase client."""
    from supabase import create_client
    
    return create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    )


def fetch_r2_events(r2_client, bucket: str) -> list[dict]:
    """Download events.json from R2."""
    print(f"📥 Fetching events from R2 bucket: {bucket}")
    
    try:
        response = r2_client.get_object(Bucket=bucket, Key="events.json")
        content = response["Body"].read().decode("utf-8")
        events = json.loads(content)
        print(f"   Found {len(events)} events in R2")
        return events
    except Exception as e:
        print(f"❌ Failed to fetch from R2: {e}")
        return []


def fetch_supabase_event_titles(db) -> set[str]:
    """Get all existing event titles from Supabase (for dedup since IDs changed format)."""
    print("📋 Fetching existing Supabase event titles...")
    
    result = db.table("events").select("title").execute()
    titles = {row["title"] for row in result.data if row.get("title")}
    print(f"   Found {len(titles)} existing events in Supabase")
    return titles


def sync_events_to_supabase(db, events: list[dict], existing_titles: set[str], dry_run: bool = False) -> list[str]:
    """Insert new events into Supabase. Returns list of new event IDs."""
    # Compare by title since IDs changed format (old format -> UUID)
    new_events = [e for e in events if e.get("title") not in existing_titles]
    
    if not new_events:
        print("✅ No new events to sync")
        return []
    
    print(f"📤 Syncing {len(new_events)} new events to Supabase...")
    
    if dry_run:
        print("   [DRY RUN] Would insert:")
        for e in new_events[:10]:
            print(f"      - {e.get('id')[:8]}... {e.get('title', '')[:50]}")
        if len(new_events) > 10:
            print(f"      ... and {len(new_events) - 10} more")
        return [e["id"] for e in new_events]
    
    # Insert via RPC with individual parameters
    inserted_ids = []
    errors = 0
    
    for i, event in enumerate(new_events):
        try:
            # Extract coordinates - format is [lng, lat] list
            coords = event.get("coordinates") or []
            lng = coords[0] if len(coords) > 0 else None
            lat = coords[1] if len(coords) > 1 else None
            
            # Call insert_event with individual parameters
            result = db.rpc("insert_event", {
                "p_title": event.get("title"),
                "p_summary": event.get("summary"),
                "p_category": event.get("category"),
                "p_severity": event.get("severity"),
                "p_location_name": event.get("location_name"),
                "p_lng": lng,
                "p_lat": lat,
                "p_region": event.get("region"),
                "p_timestamp": event.get("timestamp"),
                "p_fallout_prediction": event.get("fallout_prediction"),
                "p_sources": event.get("sources", []),
            }).execute()
            
            if result.data:
                inserted_ids.append(result.data)
                if (i + 1) % 20 == 0:
                    print(f"   ✓ Inserted {i + 1}/{len(new_events)}")
            else:
                errors += 1
        except Exception as ex:
            errors += 1
            if errors <= 3:
                print(f"   ⚠️ Failed: {event.get('title', '')[:40]}... - {ex}")
    
    if errors > 0:
        print(f"   ⚠️ {errors} events failed to insert")
    
    print(f"✅ Synced {len(inserted_ids)} events to Supabase")
    return inserted_ids


async def run_full_graph_processing(
    new_event_ids: list[str],
    r2_events: list[dict],
    dry_run: bool = False,
    skip_causal: bool = False
):
    """
    Run full graph processing for new events (same as main.py pipeline).
    
    This includes:
    1. Entity extraction and resolution
    2. Entity-entity relationship edges
    3. Event-entity linking
    4. Embeddings generation
    5. Causal linking to past events
    """
    if not new_event_ids:
        return
    
    print(f"\n🔄 Running full graph processing for {len(new_event_ids)} new events...")
    
    if dry_run:
        print("   [DRY RUN] Would process graph for new events")
        return
    
    from ..enrichment import extract_entities_and_relationships
    from ..pipeline.graph_processing import process_event_for_graph
    from ..pipeline.causal_linking import process_causal_links
    
    # Initialize clients
    gemini_key = os.getenv("GEMINI_API_KEY")
    model_enrichment = os.getenv("MODEL_ENRICHMENT", "gemini-2.5-flash")
    model_synthesis = os.getenv("MODEL_SYNTHESIS", "gemini-2.5-flash")
    
    gemini_client = GeminiClient(gemini_key, model_enrichment, model_synthesis)
    db = get_supabase_client()
    
    # Create lookup from R2 events by title for entity extraction
    r2_lookup = {e.get("title"): e for e in r2_events}
    
    # Fetch the new events from database
    events = []
    for node_id in new_event_ids:
        try:
            result = db.table("events").select("*").eq("id", node_id).execute()
            if result.data:
                event = result.data[0]
                
                # Get sources from R2 event for entity extraction context
                r2_event = r2_lookup.get(event.get("title"))
                if r2_event:
                    event["sources"] = r2_event.get("sources", [])
                
                events.append(event)
        except Exception as e:
            print(f"   ⚠️ Failed to fetch event {node_id[:8]}: {e}")
    
    print(f"   Found {len(events)} events to process")
    
    # Step 1: Extract entities and relationships for each event
    print(f"\n📝 Extracting entities and relationships...")
    events_with_entities = []
    
    for i, event in enumerate(events, 1):
        title = event.get("title", "Unknown")[:50]
        print(f"   [{i}/{len(events)}] {title}...")
        
        try:
            # Build article-like dict for entity extraction
            sources = event.get("sources", [])
            source_text = "\n".join([
                f"- {s.get('headline', '')}: {s.get('summary', '')[:200]}"
                for s in sources[:5] if isinstance(s, dict)
            ])
            
            article_for_extraction = {
                "title": event.get("title", ""),
                "description": event.get("summary", ""),
                "content": f"Location: {event.get('location_name', '')}\n\nSources:\n{source_text}",
            }
            
            # Extract entities and relationships
            result = await extract_entities_and_relationships(
                gemini_client,
                article_for_extraction,
                model_enrichment
            )
            
            if result:
                # Convert Pydantic models to dicts
                event["entities"] = [e.model_dump() for e in result.entities]
                event["relationships"] = [r.model_dump() for r in result.relationships]
                print(f"      ✓ {len(event['entities'])} entities, {len(event['relationships'])} relationships")
            else:
                event["entities"] = []
                event["relationships"] = []
                print(f"      ⚠️ No entities extracted")
            
            events_with_entities.append(event)
            
        except Exception as e:
            print(f"      ⚠️ Entity extraction failed: {e}")
            event["entities"] = []
            event["relationships"] = []
            events_with_entities.append(event)
    
    # Step 2: Process graph (entity resolution, edges, embeddings)
    print(f"\n🕸️  Processing knowledge graph...")
    success = 0
    failed = 0
    
    for i, event in enumerate(events_with_entities, 1):
        title = event.get("title", "Unknown")[:50]
        try:
            await process_event_for_graph(
                event,
                gemini_client,
                db,
                enable_entities=True,
                enable_embeddings=True
            )
            success += 1
        except Exception as e:
            print(f"   ❌ Graph processing failed for '{title}': {e}")
            failed += 1
    
    print(f"\n   ✅ Graph processing: {success} succeeded, {failed} failed")
    
    # Step 3: Causal linking (connect new events to related past events)
    if not skip_causal and events_with_entities:
        print(f"\n🔗 Running causal linking...")
        try:
            # Prepare events for causal analysis
            events_for_linking = []
            for event in events_with_entities:
                events_for_linking.append({
                    "id": event.get("id"),
                    "title": event.get("title"),
                    "category": event.get("category"),
                    "severity": event.get("severity"),
                    "location_name": event.get("location_name"),
                    "timestamp": event.get("timestamp"),
                    "entities": event.get("entities", []),
                })
            
            await process_causal_links(
                events_for_linking,
                db,
                days_back=7,
                min_score=5.0  # Requires location or entity match
            )
            print(f"   ✅ Causal linking complete")
        except Exception as e:
            print(f"   ⚠️ Causal linking failed: {e}")
    elif skip_causal:
        print(f"\n⏭️ Skipping causal linking (--no-causal)")
    
    print(f"\n✅ Full graph processing complete")


def main():
    parser = argparse.ArgumentParser(description="Sync R2 events to Supabase with full pipeline processing")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    parser.add_argument("--no-graph", action="store_true", help="Skip graph processing")
    parser.add_argument("--no-causal", action="store_true", help="Skip causal linking")
    parser.add_argument("--bucket", default=os.getenv("R2_BUCKET", "realpolitik-events"), help="R2 bucket name")
    args = parser.parse_args()
    
    print("=" * 60)
    print("R2 → Supabase Sync (Full Pipeline)")
    print("=" * 60)
    
    if args.dry_run:
        print("🔍 DRY RUN MODE - no changes will be made\n")
    
    # Check required env vars
    required = ["R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
                "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]
    
    # Graph processing also needs Gemini
    if not args.no_graph:
        required.append("GEMINI_API_KEY")
    
    missing = [v for v in required if not os.getenv(v)]
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        sys.exit(1)
    
    # Get clients
    r2 = get_r2_client()
    db = get_supabase_client()
    
    # Fetch events from both sources
    r2_events = fetch_r2_events(r2, args.bucket)
    if not r2_events:
        print("❌ No events found in R2")
        sys.exit(1)
    
    existing_titles = fetch_supabase_event_titles(db)
    
    # Sync new events (compare by title since ID format changed)
    new_ids = sync_events_to_supabase(db, r2_events, existing_titles, args.dry_run)
    
    # Run full graph processing (entities, relationships, embeddings, causal links)
    if new_ids and not args.no_graph:
        asyncio.run(run_full_graph_processing(
            new_ids,
            r2_events,
            dry_run=args.dry_run,
            skip_causal=args.no_causal
        ))
    elif args.no_graph:
        print("\n⏭️ Skipping graph processing (--no-graph)")
    
    print("\n" + "=" * 60)
    print("✅ Sync complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
