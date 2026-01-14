#!/usr/bin/env python3
"""
Fix Locations Script
====================
Re-geocodes all events in R2 using the new 3-tier geocoding system:
1. Dictionary lookup (instant)
2. Redis cache (fast)
3. LLM geocoding (accurate)

Usage:
    python fix_locations.py --dry-run    # Preview changes without saving
    python fix_locations.py              # Apply fixes to R2
"""

import asyncio
import json
import os
import sys
from datetime import datetime

import boto3
from google import genai

# Import our geocoding system
from locations import LOCATIONS
from main import (
    lookup_location_in_dict,
    geocode_location_llm,
    GeocodedLocation,
    get_cached_geocodes_batch,
    cache_geocodes_batch,
)


def get_r2_client():
    """Create R2 client."""
    return boto3.client(
        "s3",
        endpoint_url=os.getenv("R2_ENDPOINT_URL"),
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    )


def download_events() -> list[dict]:
    """Download events.json from R2."""
    s3 = get_r2_client()
    bucket = os.getenv("R2_BUCKET_NAME")
    
    response = s3.get_object(Bucket=bucket, Key="events.json")
    return json.loads(response["Body"].read().decode("utf-8"))


def upload_events(events: list[dict]) -> None:
    """Upload events.json to R2."""
    s3 = get_r2_client()
    bucket = os.getenv("R2_BUCKET_NAME")
    
    # Backup first
    print("💾 Backing up current events.json...")
    try:
        s3.copy_object(
            Bucket=bucket,
            CopySource=f"{bucket}/events.json",
            Key=f"events-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json",
        )
    except Exception as e:
        print(f"   ⚠️ Backup failed: {e}")
    
    # Upload new
    s3.put_object(
        Bucket=bucket,
        Key="events.json",
        Body=json.dumps(events, indent=2),
        ContentType="application/json",
    )


async def fix_locations(dry_run: bool = False):
    """Main function to fix all event locations."""
    
    print("=" * 70)
    print("LOCATION FIX SCRIPT")
    print("=" * 70)
    
    if dry_run:
        print("🔍 DRY RUN MODE - no changes will be saved")
    print()
    
    # Download events
    print("📥 Downloading events from R2...")
    events = download_events()
    print(f"   Loaded {len(events)} events")
    
    # Collect unique locations
    unique_locations = set()
    for e in events:
        unique_locations.add(e.get("location_name", "Unknown"))
    
    print(f"\n📍 Found {len(unique_locations)} unique locations")
    
    # Geocode all locations using our 3-tier system
    print("\n🔄 Re-geocoding all locations...")
    print("-" * 70)
    
    geocoded_results: dict[str, GeocodedLocation | None] = {}
    
    # Tier 1: Dictionary lookup
    need_cache = []
    for loc in unique_locations:
        result = lookup_location_in_dict(loc)
        if result:
            geocoded_results[loc] = result
        else:
            need_cache.append(loc)
    
    dict_hits = len(unique_locations) - len(need_cache)
    print(f"   ✓ {dict_hits} from dictionary")
    
    # Tier 2: Redis cache
    need_llm = []
    if need_cache:
        cached = get_cached_geocodes_batch(need_cache)
        for loc in need_cache:
            if loc in cached:
                data = cached[loc]
                geocoded_results[loc] = GeocodedLocation(
                    longitude=data["longitude"],
                    latitude=data["latitude"],
                    canonical_name=data["canonical_name"],
                    confidence=data["confidence"],
                )
            else:
                need_llm.append(loc)
        
        cache_hits = len(need_cache) - len(need_llm)
        if cache_hits > 0:
            print(f"   ⚡ {cache_hits} from cache")
    
    # Tier 3: LLM geocoding
    if need_llm:
        print(f"   🤖 {len(need_llm)} need LLM geocoding...")
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("   ❌ GEMINI_API_KEY not set - skipping LLM geocoding")
            for loc in need_llm:
                geocoded_results[loc] = None
        else:
            client = genai.Client(api_key=api_key)
            new_cache = {}
            
            for loc in need_llm:
                result = await geocode_location_llm(client, loc)
                geocoded_results[loc] = result
                
                if result:
                    conf_icon = {"exact": "✓", "nearby": "≈", "estimated": "~"}.get(result.confidence, "?")
                    print(f"      {conf_icon} {loc[:40]} → ({result.longitude:.2f}, {result.latitude:.2f})")
                    new_cache[loc] = {
                        "longitude": result.longitude,
                        "latitude": result.latitude,
                        "canonical_name": result.canonical_name,
                        "confidence": result.confidence,
                    }
                else:
                    print(f"      ✗ {loc[:40]} → failed")
            
            # Cache new results
            if new_cache:
                cache_geocodes_batch(new_cache)
                print(f"   💾 Cached {len(new_cache)} new geocodes")
    
    # Apply fixes to events
    print("\n📝 Applying fixes to events...")
    print("-" * 70)
    
    changes = []
    for event in events:
        loc_name = event.get("location_name", "")
        old_coords = event.get("coordinates", [0, 0])
        
        geocoded = geocoded_results.get(loc_name)
        if geocoded:
            new_coords = [geocoded.longitude, geocoded.latitude]
            new_name = geocoded.canonical_name
            
            # Check if coordinates changed significantly
            lng_diff = abs(old_coords[0] - new_coords[0])
            lat_diff = abs(old_coords[1] - new_coords[1])
            
            if lng_diff > 0.5 or lat_diff > 0.5 or loc_name != new_name:
                changes.append({
                    "id": event["id"],
                    "old_name": loc_name,
                    "new_name": new_name,
                    "old_coords": old_coords,
                    "new_coords": new_coords,
                    "title": event.get("title", "")[:50],
                })
                
                # Apply the fix
                event["coordinates"] = new_coords
                event["location_name"] = new_name
    
    # Report changes
    print(f"\n📊 CHANGES SUMMARY: {len(changes)} events need coordinate fixes")
    print("-" * 70)
    
    for c in changes[:30]:  # Show first 30
        print(f"\n• {c['title']}...")
        print(f"  Location: {c['old_name']}")
        if c['old_name'] != c['new_name']:
            print(f"       → {c['new_name']}")
        print(f"  Coords: ({c['old_coords'][0]:.2f}, {c['old_coords'][1]:.2f})")
        print(f"      → ({c['new_coords'][0]:.2f}, {c['new_coords'][1]:.2f})")
    
    if len(changes) > 30:
        print(f"\n   ... and {len(changes) - 30} more")
    
    # Upload if not dry run
    if not dry_run and changes:
        print("\n📤 Uploading fixed events to R2...")
        upload_events(events)
        print("   ✅ Done!")
    elif dry_run:
        print("\n🔍 DRY RUN - no changes saved")
        print("   Run without --dry-run to apply fixes")
    else:
        print("\n✅ No changes needed - all locations are correct!")
    
    print("\n" + "=" * 70)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Fix event locations using geocoding system")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without saving")
    args = parser.parse_args()
    
    # Check credentials
    required_env = ["R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"]
    missing = [e for e in required_env if not os.getenv(e)]
    if missing:
        print(f"❌ Missing environment variables: {', '.join(missing)}")
        sys.exit(1)
    
    asyncio.run(fix_locations(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
