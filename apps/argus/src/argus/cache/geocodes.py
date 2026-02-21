"""
Geocode caching to avoid re-geocoding the same locations.
"""

import json
import sys
from .redis import redis_request


def _normalize_location_key(location_name: str) -> str:
    """Normalize location name for cache key (lowercase, stripped, spaces to underscores)."""
    return location_name.lower().strip().replace(" ", "_").replace(",", "")


def get_cached_geocode(redis_url: str, redis_token: str, location_name: str) -> dict | None:
    """
    Get cached geocode result from Redis.
    
    Returns dict with {longitude, latitude, canonical_name, confidence} or None.
    """
    key = _normalize_location_key(location_name)
    result = redis_request(redis_url, redis_token, "GET", f"/get/geocode:{key}")
    
    if result and result.get("result"):
        try:
            return json.loads(result["result"])
        except (json.JSONDecodeError, TypeError):
            pass
    return None


def cache_geocode(
    redis_url: str,
    redis_token: str,
    location_name: str,
    geocoded: dict,
    ttl_days: int
) -> None:
    """
    Cache a geocode result in Redis.
    
    Args:
        redis_url: Redis REST URL
        redis_token: Redis REST token
        location_name: Original location name (will be normalized for key)
        geocoded: Dict with {longitude, latitude, canonical_name, confidence}
        ttl_days: Cache TTL in days
    """
    if not redis_url:
        return
    
    key = _normalize_location_key(location_name)
    ttl_seconds = ttl_days * 24 * 3600
    value = json.dumps(geocoded)
    
    # Use pipeline format to safely handle JSON values (avoids URL encoding issues)
    redis_request(redis_url, redis_token, "POST", "/pipeline", [
        ["SET", f"geocode:{key}", value, "EX", str(ttl_seconds)]
    ])


def get_cached_geocodes_batch(
    redis_url: str,
    redis_token: str,
    location_names: list[str]
) -> dict[str, dict]:
    """
    Batch lookup of cached geocodes.
    
    Returns dict mapping location_name -> geocoded result (for cache hits only).
    """
    if not location_names or not redis_url:
        return {}
    
    # Build keys
    keys = [f"geocode:{_normalize_location_key(loc)}" for loc in location_names]
    result = redis_request(redis_url, redis_token, "POST", "/mget", keys)
    
    cached = {}
    if result and result.get("result"):
        for i, val in enumerate(result["result"]):
            if val is not None:
                try:
                    cached[location_names[i]] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    pass
    return cached


def cache_geocodes_batch(
    redis_url: str,
    redis_token: str,
    geocodes: dict[str, dict],
    ttl_days: int
) -> None:
    """
    Batch cache multiple geocode results.
    
    Args:
        redis_url: Redis REST URL
        redis_token: Redis REST token
        geocodes: Dict mapping location_name -> {longitude, latitude, canonical_name, confidence}
        ttl_days: Cache TTL in days
    """
    if not geocodes or not redis_url:
        return
    
    ttl_seconds = ttl_days * 24 * 3600
    
    pipeline = []
    for loc_name, geocoded in geocodes.items():
        key = _normalize_location_key(loc_name)
        value = json.dumps(geocoded)
        pipeline.append(["SET", f"geocode:{key}", value, "EX", str(ttl_seconds)])
    
    redis_request(redis_url, redis_token, "POST", "/pipeline", pipeline)


def invalidate_geocode_cache(
    redis_url: str,
    redis_token: str,
    location_names: list[str]
) -> int:
    """
    Invalidate (delete) cached geocodes for specific locations.
    
    Use this when you've corrected coordinates in the LOCATIONS dictionary
    and need to clear stale cache entries.
    
    Args:
        redis_url: Redis REST URL
        redis_token: Redis REST token
        location_names: List of location names to invalidate
        
    Returns:
        Number of keys deleted (or attempted to delete)
    """
    if not location_names or not redis_url:
        return 0
    
    # Use DEL command in pipeline for batch deletion
    pipeline = []
    for loc_name in location_names:
        key = _normalize_location_key(loc_name)
        pipeline.append(["DEL", f"geocode:{key}"])
    
    result = redis_request(redis_url, redis_token, "POST", "/pipeline", pipeline)
    
    if result and result.get("result"):
        deleted = sum(1 for r in result["result"] if r == 1)
        print(f"🗑️  Invalidated {deleted}/{len(location_names)} geocode cache entries")
        return deleted
    return 0


def invalidate_all_geocode_cache(redis_url: str, redis_token: str) -> int:
    """
    Invalidate ALL geocode cache entries.
    
    Use with caution - this will force re-geocoding of all locations
    on the next worker run (costs API credits for LLM calls).
    
    Returns:
        Number of keys deleted
    """
    if not redis_url:
        return 0
    
    # Use SCAN to find all geocode keys, then delete them
    # Note: Upstash REST API uses a different pattern for SCAN
    keys_to_delete = []
    cursor = "0"
    
    while True:
        result = redis_request(redis_url, redis_token, "POST", "/scan", [cursor, "MATCH", "geocode:*", "COUNT", "100"])
        if not result or not result.get("result"):
            break
        
        cursor, keys = result["result"]
        keys_to_delete.extend(keys)
        
        if cursor == "0":
            break
    
    if keys_to_delete:
        # Delete in batches
        pipeline = [["DEL", key] for key in keys_to_delete]
        redis_request(redis_url, redis_token, "POST", "/pipeline", pipeline)
        print(f"🗑️  Invalidated {len(keys_to_delete)} geocode cache entries")
        return len(keys_to_delete)
    
    return 0
