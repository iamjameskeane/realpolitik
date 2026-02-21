"""
Graph processing pipeline for Constellation features.
"""

from ..enrichment import (
    extract_entities_and_relationships,
    validate_entities,
    validate_relationships,
)
from ..graph import (
    generate_embedding,
    generate_batch_embeddings,
    resolve_entity,
    upsert_edge,
    link_event_to_entities,
    update_event_embedding,
)
from ..models import BLACKLISTED_ENTITY_TYPES


async def process_event_for_graph(
    event: dict,
    gemini_client,
    db,
    enable_entities: bool = True,
    enable_embeddings: bool = True
) -> dict:
    """
    Process an event for knowledge graph integration.
    
    Flow:
    1. Extract entities and relationships (if enabled)
    2. Generate embeddings for entities
    3. Resolve entities to canonical form
    4. Create/update nodes
    5. Create/update edges
    6. Link event to entities
    
    Args:
        event: GeoEvent dict
        gemini_client: Gemini client for embeddings
        db: Supabase client
        enable_entities: Whether to extract entities
        enable_embeddings: Whether to generate embeddings
    
    Returns:
        Updated event dict with graph metadata
    """
    if not enable_entities:
        return event
    
    print(f"\n🔗 Processing '{event.get('title', 'Unknown')[:50]}...' for graph")
    
    # Get entities and relationships from event (should be pre-extracted)
    entities = event.get("entities", [])
    relationships = event.get("relationships", [])
    
    if not entities:
        print("   ⚠️ No entities to process")
        return event
    
    # Filter out blacklisted entity types (e.g., "event", "population")
    original_count = len(entities)
    entities = [e for e in entities if e.get("type", "").lower() not in BLACKLISTED_ENTITY_TYPES]
    filtered_count = original_count - len(entities)
    
    if filtered_count > 0:
        print(f"   ↳ Filtered {filtered_count} blacklisted entity types")
    
    if not entities:
        print("   ⚠️ No valid entities after filtering")
        return event
    
    print(f"   Entities: {len(entities)}, Relationships: {len(relationships)}")
    
    # Generate embeddings for entities (3072d to match database halfvec(3072))
    if enable_embeddings:
        entity_texts = [e["name"] for e in entities]
        print(f"   🧮 Generating embeddings for {len(entity_texts)} entities...")
        
        try:
            embeddings = await generate_batch_embeddings(
                gemini_client,
                entity_texts,
                task_type="SEMANTIC_SIMILARITY",
                dimensions=3072
            )
        except Exception as e:
            print(f"   ⚠️ Embedding generation failed: {e}")
            embeddings = [None] * len(entities)
    else:
        embeddings = [None] * len(entities)
    
    # Resolve entities to canonical UUIDs
    print(f"   🔍 Resolving entities...")
    resolved_entities = {}  # name -> UUID mapping
    entity_roles = {}  # UUID -> role mapping
    
    for entity, embedding in zip(entities, embeddings):
        try:
            entity_uuid = await resolve_entity(
                db,
                entity["name"],
                entity["type"],
                embedding
            )
            resolved_entities[entity["name"]] = entity_uuid
            entity_roles[entity_uuid] = entity.get("role", "mentioned")
        except Exception as e:
            print(f"   ⚠️ Failed to resolve entity '{entity['name']}': {e}")
    
    print(f"   ✓ Resolved {len(resolved_entities)} entities")
    
    # Create edges for relationships
    if relationships and len(resolved_entities) > 0:
        print(f"   🔗 Creating {len(relationships)} edges...")
        edges_created = 0
        skipped_self_loops = 0
        
        for rel in relationships:
            from_uuid = resolved_entities.get(rel["from_entity"])
            to_uuid = resolved_entities.get(rel["to_entity"])
            
            if not from_uuid or not to_uuid:
                continue
            
            # Skip self-loops (can happen when two entity names resolve to same canonical entity)
            if from_uuid == to_uuid:
                skipped_self_loops += 1
                continue
            
            try:
                await upsert_edge(
                    db,
                    from_uuid,
                    to_uuid,
                    rel.get("relation_type") or rel.get("rel_type", "related_to"),
                    percentage=rel.get("percentage"),
                    confidence=0.6,  # LLM extraction confidence
                    polarity=rel.get("polarity", 0.0),
                    detail=rel.get("detail")
                )
                edges_created += 1
            except Exception as e:
                print(f"   ⚠️ Failed to create edge: {e}")
        
        if skipped_self_loops:
            print(f"   ↳ Skipped {skipped_self_loops} self-loops (entity resolution merged names)")
        print(f"   ✓ Created/updated {edges_created} edges")
    
    # Link event to entities (many-to-many)
    if resolved_entities:
        entity_uuids = list(resolved_entities.values())
        roles = [entity_roles.get(uuid, "mentioned") for uuid in entity_uuids]
        
        try:
            await link_event_to_entities(
                db,
                event["id"],
                entity_uuids,
                roles
            )
            print(f"   ✓ Linked event to {len(entity_uuids)} entities")
        except Exception as e:
            print(f"   ⚠️ Failed to link event to entities: {e}")
    
    # Update event node embedding for semantic search
    # Note: Events are already nodes in Atlas (created via insert_event RPC)
    if enable_embeddings:
        try:
            # Generate 1536d embedding for event text
            event_text = f"{event.get('title', '')} {event.get('summary', '')}"
            event_embedding = await generate_embedding(
                gemini_client,
                event_text,
                task_type="RETRIEVAL_DOCUMENT",
                dimensions=3072  # Match database halfvec(3072)
            )
            
            await update_event_embedding(
                db,
                event["id"],
                event_embedding
            )
            print(f"   ✓ Updated event embedding")
        except Exception as e:
            print(f"   ⚠️ Failed to update event embedding: {e}")
    
    return event


async def process_batch_for_graph(
    events: list[dict],
    gemini_client,
    db,
    enable_entities: bool = True,
    enable_embeddings: bool = True
) -> list[dict]:
    """
    Process a batch of events for graph integration.
    
    Args:
        events: List of GeoEvent dicts
        gemini_client: Gemini client
        db: Supabase client
        enable_entities: Whether to extract entities
        enable_embeddings: Whether to generate embeddings
    
    Returns:
        List of updated event dicts
    """
    if not enable_entities or not events:
        return events
    
    print(f"\n📊 Processing {len(events)} events for knowledge graph...")
    
    updated_events = []
    for event in events:
        updated_event = await process_event_for_graph(
            event,
            gemini_client,
            db,
            enable_entities,
            enable_embeddings
        )
        updated_events.append(updated_event)
    
    return updated_events
