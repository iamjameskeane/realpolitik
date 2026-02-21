"""
Shared storage utilities for event merging.
"""

import math
from datetime import datetime, timedelta
from ..models.events import EventSource, SynthesizedEvent
from ..enrichment.synthesis import synthesize_incident


def retention_score(event: dict, severity_bonus_hours: dict[int, int]) -> datetime:
    """
    Calculate retention score for an event.
    
    Higher severity events get a time bonus, making them sort higher
    and stay in the dataset longer even if they haven't been updated recently.
    
    Args:
        event: Event dict with timestamp and severity
        severity_bonus_hours: Mapping of severity -> bonus hours
    
    Returns:
        Adjusted datetime for sorting
    """
    timestamp = event.get("last_updated", event["timestamp"])
    dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    severity = event.get("severity", 5)
    bonus_hours = severity_bonus_hours.get(severity, 0)
    return dt + timedelta(hours=bonus_hours)


def find_similar_existing_event(
    new_event: dict,
    existing_events: dict[str, dict],
    distance_threshold: float = 1.0,  # ~100km
    time_hours: int = 24,
) -> dict | None:
    """
    Find an existing event that's similar enough to merge with.
    Uses category + location + time proximity.
    
    Args:
        new_event: New event dict
        existing_events: Dict of existing events by ID
        distance_threshold: Max distance in degrees for matching
        time_hours: Max time difference in hours for matching
    
    Returns:
        Matching event dict or None
    """
    new_cat = new_event.get("category")
    new_coords = new_event.get("coordinates", [0, 0])
    new_time = new_event.get("timestamp", "")
    
    try:
        new_dt = datetime.fromisoformat(new_time.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None
    
    for existing in existing_events.values():
        # Must be same category
        if existing.get("category") != new_cat:
            continue
        
        # Check location proximity
        ex_coords = existing.get("coordinates", [0, 0])
        distance = math.sqrt(
            (new_coords[0] - ex_coords[0]) ** 2 + 
            (new_coords[1] - ex_coords[1]) ** 2
        )
        if distance > distance_threshold:
            continue
        
        # Check time proximity
        ex_time = existing.get("timestamp", "")
        try:
            ex_dt = datetime.fromisoformat(ex_time.replace("Z", "+00:00"))
            hours_diff = abs((new_dt - ex_dt).total_seconds()) / 3600
            if hours_diff > time_hours:
                continue
        except (ValueError, AttributeError):
            continue
        
        # Found a match!
        return existing
    
    return None


async def merge_with_existing(
    new_events: list,
    existing_data: list[dict],
    gemini_client,
    max_events: int,
    severity_bonus_hours: dict[int, int],
    synthesis_model: str,
) -> list[dict]:
    """
    Merge new events with existing events, adding sources to matching incidents.
    Re-synthesizes title/summary when new sources are added.
    
    Matching is done by:
    1. Exact ID match (fastest)
    2. Category + location + time proximity (catches centroid drift)
    
    Args:
        new_events: List of new GeoEvent objects
        existing_data: List of existing event dicts
        gemini_client: Gemini client for re-synthesis
        max_events: Maximum events to keep
        severity_bonus_hours: Severity -> bonus hours mapping
        synthesis_model: Model name for synthesis
    
    Returns:
        List of merged event dicts
    """
    # Index existing events by ID
    existing_by_id: dict[str, dict] = {e["id"]: e for e in existing_data}
    
    # Track source IDs we've seen (to avoid duplicates)
    seen_source_ids: set[str] = set()
    for event in existing_data:
        for source in event.get("sources", []):
            seen_source_ids.add(source.get("id", ""))
    
    merged_count = 0
    new_count = 0
    events_needing_synthesis: list[dict] = []
    
    for event in new_events:
        event_dict = event.model_dump()
        event_dict["coordinates"] = list(event_dict["coordinates"])
        
        # Convert sources to dicts
        event_dict["sources"] = [s.model_dump() if hasattr(s, 'model_dump') else s for s in event_dict["sources"]]
        
        # Try exact ID match first
        existing = existing_by_id.get(event.id)
        
        # If no exact match, try similarity-based matching
        if not existing:
            existing = find_similar_existing_event(event_dict, existing_by_id)
        
        if existing:
            # Merge sources into existing event
            existing_sources = existing.get("sources", [])
            
            # Add new sources that we haven't seen
            new_sources = []
            for source in event_dict["sources"]:
                if source["id"] not in seen_source_ids:
                    new_sources.append(source)
                    seen_source_ids.add(source["id"])
            
            if new_sources:
                merged_count += 1
                old_source_count = len(existing_sources)
                existing_sources.extend(new_sources)
                new_source_count = len(existing_sources)
                
                # Sort by timestamp
                existing_sources.sort(key=lambda s: s["timestamp"])
                existing["sources"] = existing_sources
                
                # Update timestamps
                existing["last_updated"] = max(
                    existing.get("last_updated", existing["timestamp"]),
                    event_dict["last_updated"]
                )
                
                # Update severity to max
                existing["severity"] = max(existing["severity"], event_dict["severity"])
                
                # BATCH RE-SYNTHESIS: Only re-synthesize every 2 sources
                # This saves API costs while keeping events reasonably up-to-date
                last_synth_count = existing.get("_last_synthesis_count", old_source_count)
                sources_since_synthesis = new_source_count - last_synth_count
                
                if sources_since_synthesis >= 2:
                    events_needing_synthesis.append(existing)
                    existing["_last_synthesis_count"] = new_source_count
        else:
            # Check if any sources already exist in another event
            unique_sources = []
            for source in event_dict["sources"]:
                if source["id"] not in seen_source_ids:
                    unique_sources.append(source)
                    seen_source_ids.add(source["id"])
            
            if unique_sources:
                event_dict["sources"] = unique_sources
                existing_by_id[event.id] = event_dict
                new_count += 1
    
    # Re-synthesize events that got new sources
    if events_needing_synthesis and gemini_client:
        print(f"\n🔄 Re-synthesizing {len(events_needing_synthesis)} events with new sources...")
        
        synthesis_tasks = []
        for event in events_needing_synthesis:
            # Convert source dicts to EventSource objects for synthesis
            sources = [
                EventSource(
                    id=s["id"],
                    headline=s["headline"],
                    summary=s["summary"],
                    source_name=s["source_name"],
                    source_url=s["source_url"],
                    timestamp=s["timestamp"],
                )
                for s in event["sources"]
            ]
            synthesis_tasks.append(
                synthesize_incident(
                    gemini_client,
                    sources,
                    synthesis_model,
                    event.get("location_name", "")
                )
            )
        
        import asyncio
        synthesis_results = await asyncio.gather(*synthesis_tasks)
        
        # Update events with synthesized content
        for event, synthesized in zip(events_needing_synthesis, synthesis_results):
            if synthesized:
                event["title"] = synthesized.title
                event["summary"] = synthesized.summary
                if synthesized.fallout_prediction:
                    event["fallout_prediction"] = synthesized.fallout_prediction
                # Use synthesized severity if higher
                if synthesized.severity > event["severity"]:
                    event["severity"] = synthesized.severity
                print(f"  ✓ Re-synthesized: {event.get('location_name', 'Unknown')} ({len(event['sources'])} sources)")
    
    # Sort by retention score (severity-weighted) descending
    all_events = sorted(
        existing_by_id.values(),
        key=lambda e: retention_score(e, severity_bonus_hours),
        reverse=True
    )
    
    # Keep top events by retention score
    final_events = all_events[:max_events]
    
    if merged_count > 0:
        print(f"🔗 Merged {merged_count} incidents with existing events")
    if new_count > 0:
        print(f"✨ Added {new_count} new incidents")
    
    return final_events
