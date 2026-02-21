"""
Local JSON file storage backend.
"""

import json
import shutil
from pathlib import Path
from ..utils.hashing import generate_source_id
from ..regions import get_region
from .base import merge_with_existing


async def write_local(
    events: list,
    path: Path,
    gemini_client,
    max_events: int,
    severity_bonus_hours: dict[int, int],
    synthesis_model: str
) -> list[dict]:
    """
    Write events to local JSON file, merging with existing events.
    
    Args:
        events: List of GeoEvent objects
        path: Path to output JSON file
        gemini_client: Gemini client for re-synthesis
        max_events: Maximum events to keep
        severity_bonus_hours: Severity -> bonus hours mapping
        synthesis_model: Model name for synthesis
    
    Returns:
        The final merged event list for notification processing.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    
    # Load existing events
    existing_data: list[dict] = []
    if path.exists():
        try:
            with open(path, "r") as f:
                existing_data = json.load(f)
            
            # SAFETY NET: Backup current file before overwriting
            backup_path = path.with_suffix(".backup.json")
            shutil.copy2(path, backup_path)
            print(f"💾 Backed up to {backup_path.name}")
        except (json.JSONDecodeError, KeyError):
            pass
    
    # Migrate legacy events (without sources array)
    for event in existing_data:
        if "sources" not in event:
            # Convert legacy format to new format
            event["sources"] = [{
                "id": generate_source_id(event.get("title", ""), event.get("source_url")),
                "headline": event.get("title", ""),
                "summary": event.get("summary", ""),
                "source_name": event.get("source_name", "Unknown"),
                "source_url": event.get("source_url", ""),
                "timestamp": event.get("timestamp", ""),
            }]
            event["last_updated"] = event.get("timestamp", "")
        
        # Add region field to events that don't have it
        if "region" not in event:
            event["region"] = get_region(event.get("location_name", ""))
    
    # Merge with existing (re-synthesizes when new sources added)
    final_events = await merge_with_existing(
        events,
        existing_data,
        gemini_client,
        max_events,
        severity_bonus_hours,
        synthesis_model
    )
    
    with open(path, "w") as f:
        json.dump(final_events, f, indent=2)
    
    total_sources = sum(len(e.get("sources", [])) for e in final_events)
    print(f"💾 Wrote {len(final_events)} incidents ({total_sources} total sources) to {path}")
    
    return final_events
