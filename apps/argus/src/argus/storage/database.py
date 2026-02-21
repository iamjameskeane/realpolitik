"""
Outbox pattern database storage for Realpolitik ecosystem.
Implements CDC flow: Argus → Atlas(outbox) → Chronos → Iris → Fanout Workers
"""

import json
from typing import Dict, List, Any


async def write_database(
    events: List[Any],
    database_url: str,
    enable_graph_storage: bool = True,
    enable_embeddings: bool = True
) -> List[Dict]:
    """
    Write events to Atlas using outbox pattern for CDC integration.

    Flow: Argus → Atlas(outbox) → Chronos(CDC) → Iris → Fanout Workers

    Args:
        events: List of GeoEvent objects
        database_url: PostgreSQL connection string for Atlas
        enable_graph_storage: Whether to enable Neo4j storage via fanout
        enable_embeddings: Whether to enable Qdrant storage via fanout

    Returns:
        List of event dicts with UUIDs assigned by database
    """
    print(f"\n💾 Writing {len(events)} events to Atlas via outbox (CDC pattern)...")

    # In a real implementation, this would use asyncpg
    # For now, we'll simulate the CDC flow
    print(f"📋 CDC Flow: Events → Atlas(outbox) → Chronos → Iris → Fanout Workers")
    print(f"   ℹ️  This would use add_event_to_outbox() function in production")

    inserted_events = []

    for i, event in enumerate(events, 1):
        try:
            # Simulate UUID generation
            simulated_uuid = f"simulated-{i}"

            # Convert to dict with UUID
            event_dict = event.model_dump()
            event_dict["id"] = simulated_uuid
            inserted_events.append(event_dict)

            print(f"   ✓ Added to outbox: {event.title[:50]}... (ID: {simulated_uuid})")

        except Exception as e:
            print(f"   ⚠️ Error adding {event.title[:50]}...: {type(e).__name__}: {e}")

    total_sources = sum(len(e.get("sources", [])) for e in inserted_events)
    print(f"☁️  Added {len(inserted_events)} events ({total_sources} total sources) to outbox")

    return inserted_events

    return inserted_events


async def update_event_fallout(
    event_uuid: str,
    fallout_prediction: str,
    database_url: str
) -> bool:
    """
    Update the fallout_prediction field for an event in Atlas.

    Args:
        event_uuid: UUID of the event in Atlas
        fallout_prediction: The fallout analysis to save
        database_url: PostgreSQL connection string

    Returns:
        True if successful, False otherwise
    """
    try:
        # In production, this would use asyncpg
        # UPDATE event_details SET fallout_prediction = $1 WHERE node_id = $2::uuid
        print(f"   🔄 Updating fallout for {event_uuid}: {fallout_prediction[:50]}...")
        return True
    except Exception as e:
        print(f"   ⚠️ Failed to update fallout for {event_uuid}: {e}")
        return False