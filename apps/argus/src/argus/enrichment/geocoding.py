"""
Location geocoding using reference dictionary and LLM fallback.
"""

import asyncio
import sys
from ..models.locations import GeocodedLocation
from ..locations import LOCATIONS, get_location_prompt_context
from .prompts import GEOCODING_PROMPT_TEMPLATE


# Cache location context at module load
_LOCATION_CONTEXT = get_location_prompt_context()


def lookup_location_in_dict(location_name: str) -> GeocodedLocation | None:
    """
    Try to find location in the local dictionary (no API call).
    
    Matching strategy (in order of preference):
    1. Exact match (case-insensitive) → confidence: "exact"
    2. Best partial match (scored by specificity) → confidence: "nearby"
    
    For partial matches, we score candidates by:
    - Length of overlap (longer = better)
    - Specificity (city-level matches preferred over country-level)
    
    Returns GeocodedLocation or None if not found.
    """
    location_lower = location_name.lower().strip()
    
    # Tier 1: Exact match (case-insensitive)
    for ref_name, coords in LOCATIONS.items():
        if ref_name.lower() == location_lower:
            return GeocodedLocation(
                longitude=coords[0],
                latitude=coords[1],
                canonical_name=ref_name,
                confidence="exact"
            )
    
    # Tier 2: Scored partial matches - find best candidate
    # Score = length of matching portion, penalize very short matches
    best_match: tuple[str, tuple[float, float], int] | None = None  # (name, coords, score)
    
    for ref_name, coords in LOCATIONS.items():
        ref_lower = ref_name.lower()
        
        # Check if input contains reference or vice versa
        if location_lower in ref_lower:
            # Input is substring of reference (e.g., "Tehran" in "Tehran, Iran")
            score = len(location_lower)
            # Bonus for matching at word boundary
            if ref_lower.startswith(location_lower) or f", {location_lower}" in ref_lower:
                score += 10
        elif ref_lower in location_lower:
            # Reference is substring of input (e.g., "Iran" in "Northern Iran")
            score = len(ref_lower)
            # Bonus for matching at word boundary  
            if location_lower.startswith(ref_lower) or ref_lower in location_lower.split(","):
                score += 10
        else:
            continue
        
        # Penalize very short matches (< 4 chars) to avoid "New" matching "New York"
        if score < 4:
            continue
        
        # Prefer more specific locations (those with commas = city, country format)
        if "," in ref_name:
            score += 5
        
        if best_match is None or score > best_match[2]:
            best_match = (ref_name, coords, score)
    
    if best_match:
        return GeocodedLocation(
            longitude=best_match[1][0],
            latitude=best_match[1][1],
            canonical_name=best_match[0],
            confidence="nearby"  # Partial match = nearby, not exact
        )
    
    return None


async def geocode_location_llm(
    client,
    location_name: str,
    model: str,
    article_context: str = "",
    max_retries: int = 2,
) -> GeocodedLocation | None:
    """
    Geocode a location using the LLM (when dictionary/cache miss).
    
    This is a focused, single-task LLM call for maximum accuracy.
    Uses the full location reference dictionary in the prompt.
    
    Args:
        client: Gemini client wrapper
        location_name: The location to geocode (e.g., "Tehran, Iran")
        model: Model name to use
        article_context: Optional article snippet for disambiguation
        max_retries: Number of retries on failure
    
    Returns:
        GeocodedLocation with coordinates, or None on failure
    """
    prompt = GEOCODING_PROMPT_TEMPLATE.format(location_context=_LOCATION_CONTEXT)
    prompt_content = f"{prompt}\n\nLocation to geocode: {location_name}"
    if article_context:
        prompt_content += f"\n\nContext from article: {article_context[:200]}"
    
    for attempt in range(max_retries):
        try:
            response_text = await client.generate_content(
                prompt_content,
                model=model,
                response_format={"type": "json_object"}
            )
            
            if response_text:
                # Parse JSON response manually
                import json
                try:
                    response_data = json.loads(response_text)
                    # Convert to GeocodedLocation format
                    geocoded = GeocodedLocation(
                        latitude=response_data.get("latitude", 0.0),
                        longitude=response_data.get("longitude", 0.0),
                        location_name=response_data.get("location_name", location_name),
                        confidence=response_data.get("confidence", "low"),
                        normalized_name=response_data.get("normalized_name", location_name)
                    )
                    return geocoded
                except (json.JSONDecodeError, KeyError) as e:
                    print(f"   ⚠️ Failed to parse geocoding response: {e}")
                    continue
                
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
            # Log but don't fail - we'll fall back to (0, 0)
            print(f"      ⚠️ LLM geocoding failed for '{location_name}': {type(e).__name__}")
    
    return None


async def geocode_enriched_articles(
    client,
    enriched_articles: list[tuple[dict, any]],
    model: str,
    redis_url: str,
    redis_token: str,
    geocode_ttl_days: int,
) -> list[tuple[dict, any]]:
    """
    Batch geocode all enriched articles that passed the geopolitical filter.
    
    Uses a 3-tier lookup strategy:
    1. Local dictionary (instant, no API call)
    2. Redis cache (fast, no API call)
    3. LLM geocoding (slow, costs API credits - results cached)
    
    Updates the latitude/longitude fields of each EnrichedArticle.
    """
    from cache.geocodes import get_cached_geocodes_batch, cache_geocodes_batch
    
    if not enriched_articles:
        return enriched_articles
    
    print(f"\n📍 Geocoding {len(enriched_articles)} locations...")
    
    # Collect unique locations to avoid duplicate lookups
    unique_locations: set[str] = set()
    for _, enriched in enriched_articles:
        unique_locations.add(enriched.location_name)
    
    print(f"   ({len(unique_locations)} unique locations)")
    
    # Results cache for this batch
    geocoded_results: dict[str, GeocodedLocation | None] = {}
    
    # --- Tier 1: Dictionary lookup (instant, no API) ---
    need_cache_check = []
    
    for loc_name in unique_locations:
        geocoded = lookup_location_in_dict(loc_name)
        if geocoded:
            geocoded_results[loc_name] = geocoded
        else:
            need_cache_check.append(loc_name)
    
    dict_hits = len(unique_locations) - len(need_cache_check)
    if dict_hits:
        print(f"   ✓ {dict_hits} from dictionary")
    
    # --- Tier 2: Redis cache lookup (fast, no API) ---
    need_llm = []
    if need_cache_check:
        cached = get_cached_geocodes_batch(redis_url, redis_token, need_cache_check)
        
        for loc_name in need_cache_check:
            if loc_name in cached:
                # Cache hit - reconstruct GeocodedLocation
                data = cached[loc_name]
                geocoded_results[loc_name] = GeocodedLocation(
                    longitude=data["longitude"],
                    latitude=data["latitude"],
                    canonical_name=data["canonical_name"],
                    confidence=data["confidence"],
                )
            else:
                need_llm.append(loc_name)
        
        cache_hits = len(need_cache_check) - len(need_llm)
        if cache_hits > 0:
            print(f"   ⚡ {cache_hits} from cache")
    
    # --- Tier 3: LLM geocoding (slow, costs credits, cache results) ---
    if need_llm:
        print(f"   🤖 {len(need_llm)} need LLM geocoding...")
        new_cache_entries = {}
        
        for loc_name in need_llm:
            geocoded = await geocode_location_llm(client, loc_name, model)
            geocoded_results[loc_name] = geocoded
            
            if geocoded:
                conf_icon = {"exact": "✓", "nearby": "≈", "estimated": "~"}.get(geocoded.confidence, "?")
                print(f"      {conf_icon} {loc_name} → ({geocoded.longitude:.2f}, {geocoded.latitude:.2f})")
                
                # Warn on low-confidence geocodes - these should be added to the dictionary
                if geocoded.confidence == "estimated":
                    print(f"::warning::Low-confidence geocode: '{loc_name}' → ({geocoded.longitude:.2f}, {geocoded.latitude:.2f}). Consider adding to locations.py", file=sys.stderr)
                
                # Prepare for caching
                new_cache_entries[loc_name] = {
                    "longitude": geocoded.longitude,
                    "latitude": geocoded.latitude,
                    "canonical_name": geocoded.canonical_name,
                    "confidence": geocoded.confidence,
                }
            else:
                print(f"      ✗ {loc_name} → failed, using (0, 0)")
                print(f"::warning::Geocoding failed for '{loc_name}' - defaulting to (0, 0)", file=sys.stderr)
        
        # Cache new results to Redis
        if new_cache_entries:
            cache_geocodes_batch(redis_url, redis_token, new_cache_entries, geocode_ttl_days)
            print(f"   💾 Cached {len(new_cache_entries)} new geocodes")
    
    # Apply geocoded coordinates back to articles
    result = []
    for article, enriched in enriched_articles:
        geocoded = geocoded_results.get(enriched.location_name)
        if geocoded:
            enriched.longitude = geocoded.longitude
            enriched.latitude = geocoded.latitude
            enriched.location_name = geocoded.canonical_name
        result.append((article, enriched))
    
    return result
