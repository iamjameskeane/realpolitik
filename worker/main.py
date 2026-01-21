"""
Realpolitik Worker
==================
Fetches news from RSS feeds (primary) and NewsAPI (backup), enriches them 
with Gemini AI, groups them by incident, synthesizes unified events, 
and outputs to events.json.

Data Pipeline:
    RSS Feeds (real-time) → Dedupe → Gemini Enrichment → Incident Grouping → Output
    NewsAPI (backup)      ↗

Uses async/parallel processing for faster enrichment.

Hybrid Model Strategy:
    - gemini-2.5-flash-lite: Article enrichment (location, category, severity)
    - gemini-2.5-flash: Multi-source synthesis & fallout predictions (requires reasoning)

Usage:
    python main.py                    # Writes to ../public/events.json
    python main.py --output gcs       # Writes to GCS bucket (production)
"""

import asyncio
import hashlib
import json
import math
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

import httpx
from google import genai
from google.genai import types
from pydantic import BaseModel, Field, field_validator

# Import RSS feed module
from sources.rss_feeds import fetch_rss_articles, dedupe_articles

# Import location reference for geocoding accuracy
from locations import LOCATIONS, get_location_prompt_context

# Import region extraction for notification filtering
from regions import get_region

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NEWSAPI_KEY = os.getenv("NEWSAPI_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GCS_BUCKET = os.getenv("GCS_BUCKET", "")  # For production

# Upstash Redis for caching processed articles
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

# Push notification configuration
PUSH_API_URL = os.getenv("PUSH_API_URL", "https://realpolitik.world/api/push/send")
PUSH_API_SECRET = os.getenv("PUSH_API_SECRET", "")
PUSH_NOTIFICATION_THRESHOLD = 1  # Minimum severity - user rules handle filtering
PUSH_CRITICAL_THRESHOLD = 9  # Severity threshold for "critical" flag
PUSH_MAX_AGE_HOURS = 4  # Only notify for articles published within this many hours

OUTPUT_PATH = Path(__file__).parent.parent / "public" / "events.json"

# Hybrid Model Strategy:
# - Lite model for high-volume enrichment (location, category, basic analysis)
# - Full model for quality-sensitive synthesis (fallout predictions, multi-source merging)
MODEL_ENRICHMENT = "gemini-2.5-flash-lite"  # Fast, cheap, good for structured extraction
MODEL_SYNTHESIS = "gemini-2.5-flash"        # Better reasoning for fallout/synthesis

# Concurrency limit to avoid rate limiting
MAX_CONCURRENT_REQUESTS = 10

# Cache TTL for processed articles (skip re-enriching within this window)
PROCESSED_ARTICLE_TTL_HOURS = 48  # 2 days

# Incident grouping parameters
# Different radii for different categories - MILITARY needs tighter grouping
# to avoid merging "Hospital Strike" with "Border Skirmish" in dense conflict zones
GROUPING_DISTANCE_DEGREES = {
    "MILITARY": 0.1,   # ~10km - tight for conflict zones (Gaza, Ukraine)
    "DIPLOMACY": 0.5,  # ~50km - summits can be city-wide
    "ECONOMY": 0.5,    # ~50km - economic events are broader
    "UNREST": 0.3,     # ~30km - protests can spread but distinct events matter
}
GROUPING_DISTANCE_DEFAULT = 0.5  # ~50km fallback
GROUPING_TIME_HOURS = 12

# Event retention parameters
MAX_EVENTS = 500  # Maximum events to keep in the output file

# Severity-weighted retention: high-severity events get a time bonus
# This makes them sort higher and stay in the dataset longer
SEVERITY_BONUS_HOURS = {
    10: 168,  # +1 week
    9: 120,   # +5 days
    8: 72,    # +3 days
    7: 48,    # +2 days
}


# ---------------------------------------------------------------------------
# Redis Cache for Processed Articles (saves API credits)
# ---------------------------------------------------------------------------

def _redis_request(method: str, path: str, body: dict | None = None) -> dict | None:
    """Make a request to Upstash Redis REST API."""
    if not UPSTASH_REDIS_REST_URL or not UPSTASH_REDIS_REST_TOKEN:
        return None
    
    import requests
    
    url = f"{UPSTASH_REDIS_REST_URL}{path}"
    headers = {"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"}
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=5)
        else:
            resp = requests.post(url, headers=headers, json=body, timeout=5)
        
        if resp.status_code == 200:
            return resp.json()
        else:
            # Log non-200 responses for debugging
            print(f"   ⚠️ Redis {method} {path[:50]}: HTTP {resp.status_code}", file=sys.stderr)
    except Exception as e:
        # Log connection/timeout errors
        print(f"   ⚠️ Redis {method} failed: {type(e).__name__}", file=sys.stderr)
    return None


def is_article_processed(article_hash: str) -> bool:
    """Check if an article has already been processed (exists in Redis cache)."""
    result = _redis_request("GET", f"/get/processed:{article_hash}")
    return result is not None and result.get("result") is not None


def mark_article_processed(article_hash: str) -> None:
    """Mark an article as processed in Redis with TTL."""
    ttl_seconds = PROCESSED_ARTICLE_TTL_HOURS * 3600
    _redis_request("POST", f"/set/processed:{article_hash}/1/ex/{ttl_seconds}", {})


def get_processed_articles_batch(article_hashes: list[str]) -> set[str]:
    """Check multiple article hashes at once, return set of already-processed ones."""
    if not article_hashes or not UPSTASH_REDIS_REST_URL:
        return set()
    
    # Use MGET for batch lookup
    keys = [f"processed:{h}" for h in article_hashes]
    result = _redis_request("POST", "/mget", keys)
    
    if result and result.get("result"):
        processed = set()
        for i, val in enumerate(result["result"]):
            if val is not None:
                processed.add(article_hashes[i])
        return processed
    return set()


def mark_articles_processed_batch(article_hashes: list[str]) -> None:
    """Mark multiple articles as processed in a batch."""
    if not article_hashes or not UPSTASH_REDIS_REST_URL:
        return
    
    ttl_seconds = PROCESSED_ARTICLE_TTL_HOURS * 3600
    
    # Use pipeline for batch writes
    pipeline = []
    for h in article_hashes:
        pipeline.append(["SET", f"processed:{h}", "1", "EX", str(ttl_seconds)])
    
    _redis_request("POST", "/pipeline", pipeline)


# ---------------------------------------------------------------------------
# Redis Cache for Geocoded Locations (saves API credits, locations don't change)
# ---------------------------------------------------------------------------

# Geocode cache TTL: 30 days (locations are stable)
GEOCODE_CACHE_TTL_DAYS = 30


def _normalize_location_key(location_name: str) -> str:
    """Normalize location name for cache key (lowercase, stripped, spaces to underscores)."""
    return location_name.lower().strip().replace(" ", "_").replace(",", "")


def get_cached_geocode(location_name: str) -> dict | None:
    """
    Get cached geocode result from Redis.
    
    Returns dict with {longitude, latitude, canonical_name, confidence} or None.
    """
    key = _normalize_location_key(location_name)
    result = _redis_request("GET", f"/get/geocode:{key}")
    
    if result and result.get("result"):
        try:
            return json.loads(result["result"])
        except (json.JSONDecodeError, TypeError):
            pass
    return None


def cache_geocode(location_name: str, geocoded: dict) -> None:
    """
    Cache a geocode result in Redis.
    
    Args:
        location_name: Original location name (will be normalized for key)
        geocoded: Dict with {longitude, latitude, canonical_name, confidence}
    """
    if not UPSTASH_REDIS_REST_URL:
        return
    
    key = _normalize_location_key(location_name)
    ttl_seconds = GEOCODE_CACHE_TTL_DAYS * 24 * 3600
    value = json.dumps(geocoded)
    
    # Use pipeline format to safely handle JSON values (avoids URL encoding issues)
    _redis_request("POST", "/pipeline", [
        ["SET", f"geocode:{key}", value, "EX", str(ttl_seconds)]
    ])


def get_cached_geocodes_batch(location_names: list[str]) -> dict[str, dict]:
    """
    Batch lookup of cached geocodes.
    
    Returns dict mapping location_name -> geocoded result (for cache hits only).
    """
    if not location_names or not UPSTASH_REDIS_REST_URL:
        return {}
    
    # Build keys
    keys = [f"geocode:{_normalize_location_key(loc)}" for loc in location_names]
    result = _redis_request("POST", "/mget", keys)
    
    cached = {}
    if result and result.get("result"):
        for i, val in enumerate(result["result"]):
            if val is not None:
                try:
                    cached[location_names[i]] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    pass
    return cached


def cache_geocodes_batch(geocodes: dict[str, dict]) -> None:
    """
    Batch cache multiple geocode results.
    
    Args:
        geocodes: Dict mapping location_name -> {longitude, latitude, canonical_name, confidence}
    """
    if not geocodes or not UPSTASH_REDIS_REST_URL:
        return
    
    ttl_seconds = GEOCODE_CACHE_TTL_DAYS * 24 * 3600
    
    pipeline = []
    for loc_name, geocoded in geocodes.items():
        key = _normalize_location_key(loc_name)
        value = json.dumps(geocoded)
        pipeline.append(["SET", f"geocode:{key}", value, "EX", str(ttl_seconds)])
    
    _redis_request("POST", "/pipeline", pipeline)


def invalidate_geocode_cache(location_names: list[str]) -> int:
    """
    Invalidate (delete) cached geocodes for specific locations.
    
    Use this when you've corrected coordinates in the LOCATIONS dictionary
    and need to clear stale cache entries.
    
    Args:
        location_names: List of location names to invalidate
        
    Returns:
        Number of keys deleted (or attempted to delete)
    """
    if not location_names or not UPSTASH_REDIS_REST_URL:
        return 0
    
    # Use DEL command in pipeline for batch deletion
    pipeline = []
    for loc_name in location_names:
        key = _normalize_location_key(loc_name)
        pipeline.append(["DEL", f"geocode:{key}"])
    
    result = _redis_request("POST", "/pipeline", pipeline)
    
    if result and result.get("result"):
        deleted = sum(1 for r in result["result"] if r == 1)
        print(f"🗑️  Invalidated {deleted}/{len(location_names)} geocode cache entries")
        return deleted
    return 0


def invalidate_all_geocode_cache() -> int:
    """
    Invalidate ALL geocode cache entries.
    
    Use with caution - this will force re-geocoding of all locations
    on the next worker run (costs API credits for LLM calls).
    
    Returns:
        Number of keys deleted
    """
    if not UPSTASH_REDIS_REST_URL:
        return 0
    
    # Use SCAN to find all geocode keys, then delete them
    # Note: Upstash REST API uses a different pattern for SCAN
    keys_to_delete = []
    cursor = "0"
    
    while True:
        result = _redis_request("POST", "/scan", [cursor, "MATCH", "geocode:*", "COUNT", "100"])
        if not result or not result.get("result"):
            break
        
        cursor, keys = result["result"]
        keys_to_delete.extend(keys)
        
        if cursor == "0":
            break
    
    if keys_to_delete:
        # Delete in batches
        pipeline = [["DEL", key] for key in keys_to_delete]
        _redis_request("POST", "/pipeline", pipeline)
        print(f"🗑️  Invalidated {len(keys_to_delete)} geocode cache entries")
        return len(keys_to_delete)
    
    return 0


# Categories we care about
GEOPOLITICAL_KEYWORDS = [
    "military", "troops", "war", "conflict", "missile", "nuclear", "defense",
    "sanctions", "tariff", "trade war", "embargo", "economy", "recession",
    "protest", "riot", "coup", "election", "diplomacy", "summit", "treaty",
    "alliance", "nato", "un", "security council", "invasion", "border",
]

# Source credibility tiers (higher = more credible)
# Tier 3: Wire services and major international broadcasters
# Tier 2: Quality newspapers and established outlets
# Tier 1: Regional/specialty outlets
# Tier 0: Unknown/unverified (default)
# Negative: Known unreliable sources (filtered out)
SOURCE_CREDIBILITY: dict[str, int] = {
    # Tier 3: Wire Services & Major Broadcasters (most reliable)
    "associated press": 3, "ap": 3, "ap news": 3,
    "reuters": 3,
    "afp": 3, "agence france-presse": 3,
    "bbc": 3, "bbc news": 3, "bbc world": 3,
    "al jazeera": 3, "al jazeera english": 3,
    "npr": 3,
    "pbs": 3, "pbs newshour": 3,
    
    # Tier 2: Quality Papers & Established Outlets
    "the guardian": 2, "guardian": 2,
    "new york times": 2, "nyt": 2, "ny times": 2,
    "washington post": 2,
    "the economist": 2, "economist": 2,
    "financial times": 2, "ft": 2,
    "wall street journal": 2, "wsj": 2,
    "deutsche welle": 2, "dw": 2,
    "france24": 2, "france 24": 2,
    "abc news": 2,
    "cbs news": 2,
    "nbc news": 2,
    "cnn": 2,
    "politico": 2,
    "the hill": 2,
    "axios": 2,
    
    # Tier 1: Regional & Specialty Outlets
    "south china morning post": 1, "scmp": 1,
    "times of israel": 1,
    "the hindu": 1,
    "kyiv independent": 1,
    "jerusalem post": 1,
    "haaretz": 1,
    "japan times": 1,
    "straits times": 1,
    "the irish times": 1,
    "yahoo news": 1, "yahoo": 1,
    "business insider": 1,
    "new york magazine": 1,
    "the new yorker": 1,
    "the new republic": 1,
    "foreign policy": 1,
    "foreign affairs": 1,
    
    # Negative: Known unreliable/propaganda/clickbait (will be filtered)
    "sputnik": -1, "sputnikglobe": -1, "sputnik news": -1,
    "rt": -1, "russia today": -1,
    "global times": -1,  # Chinese state media
    "press tv": -1,  # Iranian state media
    "activistpost": -1,
    "zerohedge": -1,
    "infowars": -1,
    "natural news": -1,
    "the gateway pundit": -1,
    "breitbart": -1,
    "yahoo entertainment": -1,  # Often clickbait/duplicate content
    "dalenareporters": -1,
    "freerepublic": -1,
}


def get_source_credibility(source_name: str) -> int:
    """
    Get credibility score for a source.
    Returns: 3 (wire), 2 (quality), 1 (regional), 0 (unknown), -1 (unreliable)
    """
    if not source_name:
        return 0
    name_lower = source_name.lower().strip()
    # Check exact match first
    if name_lower in SOURCE_CREDIBILITY:
        return SOURCE_CREDIBILITY[name_lower]
    # Check partial matches
    for known_source, score in SOURCE_CREDIBILITY.items():
        if known_source in name_lower or name_lower in known_source:
            return score
    return 0  # Unknown source


def generate_source_id(title: str, source_url: str | None) -> str:
    """
    Generate a deterministic source ID based on article content.
    Same article = same ID, preventing duplicates across worker runs.
    """
    normalized_title = title.lower().strip() if title else ""
    content = f"{normalized_title}|{source_url or ''}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def get_grouping_distance(category: str) -> float:
    """Get the grouping distance for a category (in degrees)."""
    return GROUPING_DISTANCE_DEGREES.get(category, GROUPING_DISTANCE_DEFAULT)


def generate_incident_id(category: str, lng: float, lat: float, timestamp: str) -> str:
    """
    Generate an incident ID based on category, approximate location, and time window.
    Incidents in the same area/category/time will have the same ID.
    Uses category-specific grouping distance.
    """
    distance = get_grouping_distance(category)
    grid_lng = round(lng / distance) * distance
    grid_lat = round(lat / distance) * distance
    
    # Round time to 12-hour windows
    dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    time_bucket = dt.replace(hour=(dt.hour // 12) * 12, minute=0, second=0, microsecond=0)
    
    content = f"{category}|{grid_lng:.2f}|{grid_lat:.2f}|{time_bucket.isoformat()}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


# ---------------------------------------------------------------------------
# Shared Validators (avoid duplication across Pydantic models)
# ---------------------------------------------------------------------------

def clamp_latitude(v: float) -> float:
    """Clamp latitude to valid range [-90, 90]."""
    return max(-90.0, min(90.0, float(v)))


def clamp_longitude(v: float) -> float:
    """Clamp longitude to valid range [-180, 180]."""
    return max(-180.0, min(180.0, float(v)))


def clamp_severity(v: int) -> int:
    """Clamp severity to valid range [1, 10]."""
    return max(1, min(10, int(v)))


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------

def _clean_text(text: str) -> str:
    """
    Clean text output from GPT:
    - Strip whitespace
    - Remove broken Unicode/token artifacts
    - Normalize quotes and dashes
    """
    import re
    # Strip whitespace
    text = text.strip()
    # Remove non-ASCII that looks like broken tokens (Chinese chars in English text, etc.)
    # Keep common extended chars (accents, em-dashes, quotes)
    text = re.sub(r'[^\x00-\x7F\u00C0-\u00FF\u2010-\u2015\u2018-\u201F\u2026]+', '', text)
    # Clean up any resulting double spaces
    text = re.sub(r'\s+', ' ', text)
    # Remove trailing incomplete sentences (ending with comma, colon, etc.)
    text = re.sub(r'[,;:\s]+$', '', text)
    return text.strip()


class EnrichedArticle(BaseModel):
    """Structured FACTS extracted by Gemini Flash-Lite (no analysis/predictions).
    
    Note: Coordinates are filled in by a separate geocoding step for accuracy.
    The enrichment step focuses on analysis; geocoding is a dedicated task.
    """
    location_name: str = Field(
        ...,
        description="Human-readable location, e.g. 'Kyiv, Ukraine' or 'Washington D.C., USA'"
    )
    category: Literal["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"]
    severity: int = Field(..., description="Severity score 1-10")
    summary: str = Field(..., description="One factual sentence describing what happened")
    is_geopolitical: bool = Field(
        ...,
        description="True if this is a significant geopolitical event, False for local/minor news"
    )
    # Coordinates filled in by geocoding step (not by enrichment)
    latitude: float = Field(default=0.0, description="Filled by geocoding step")
    longitude: float = Field(default=0.0, description="Filled by geocoding step")

    @field_validator("latitude", mode="before")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        return clamp_latitude(v)

    @field_validator("longitude", mode="before")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        return clamp_longitude(v)

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: int) -> int:
        return clamp_severity(v)

    @field_validator("summary", "location_name")
    @classmethod
    def clean_text_fields(cls, v: str) -> str:
        return _clean_text(v)


class GeocodedLocation(BaseModel):
    """Result of geocoding a location name to coordinates."""
    longitude: float = Field(..., description="Longitude -180 to 180")
    latitude: float = Field(..., description="Latitude -90 to 90")
    canonical_name: str = Field(..., description="Standardized location name from reference")
    confidence: Literal["exact", "nearby", "estimated"] = Field(
        ..., 
        description="exact=matched reference, nearby=interpolated from reference, estimated=no good reference"
    )

    @field_validator("latitude", mode="before")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        return clamp_latitude(v)

    @field_validator("longitude", mode="before")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        return clamp_longitude(v)


class SynthesizedEvent(BaseModel):
    """Synthesized event data from multiple sources"""
    title: str = Field(..., description="Single headline capturing the full picture (keep under 200 chars)")
    summary: str = Field(..., description="Synthesized summary from all sources (2-3 sentences)")
    fallout_prediction: str = Field(..., description="Prediction based on complete information (2-3 sentences)")
    severity: int = Field(..., description="Severity score 1-10")

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: int) -> int:
        return clamp_severity(v)

    @field_validator("title", "summary", "fallout_prediction")
    @classmethod
    def clean_text_fields(cls, v: str) -> str:
        return _clean_text(v)


class EventSource(BaseModel):
    """A single news source contributing to an incident"""
    id: str
    headline: str
    summary: str
    source_name: str
    source_url: str
    timestamp: str  # ISO 8601


class GeoEvent(BaseModel):
    """Final event schema with multiple sources"""
    id: str
    title: str  # Synthesized headline
    category: Literal["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"]
    coordinates: tuple[float, float]  # [lng, lat]
    location_name: str
    region: str = "OTHER"  # Geographic region for notification filtering
    severity: int
    summary: str  # Synthesized summary
    timestamp: str  # Earliest source timestamp
    last_updated: str  # Latest source timestamp
    fallout_prediction: str  # Synthesized prediction
    sources: list[EventSource]


# ---------------------------------------------------------------------------
# NewsAPI Client (async)
# ---------------------------------------------------------------------------

async def fetch_headlines(api_key: str, page_size: int = 100) -> list[dict]:
    """
    Fetch top headlines from NewsAPI using async HTTP.
    """
    url = "https://newsapi.org/v2/everything"
    params = {
        "apiKey": api_key,
        "language": "en",
        "pageSize": page_size,
        "sortBy": "publishedAt",
        "q": " OR ".join(GEOPOLITICAL_KEYWORDS[:10]),
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=30)
        response.raise_for_status()
    
    data = response.json()
    if data.get("status") != "ok":
        raise ValueError(f"NewsAPI error: {data.get('message', 'Unknown error')}")
    
    articles = data.get("articles", [])
    print(f"📰 Fetched {len(articles)} articles from NewsAPI")
    
    return articles


# ---------------------------------------------------------------------------
# Gemini AI Enrichment (async)
# ---------------------------------------------------------------------------

def _get_current_date_context() -> str:
    """Generate current date context for LLM prompts to avoid outdated references."""
    now = datetime.now(timezone.utc)
    return f"""CURRENT DATE: {now.strftime('%B %d, %Y')} (UTC)

IMPORTANT POLITICAL CONTEXT (as of today):
- Donald Trump is the current US President (inaugurated January 20, 2025)
- Use current titles for world leaders, not outdated ones"""


ENRICHMENT_PROMPT = """You are a geopolitical analyst. Extract structured data ONLY from significant geopolitical news.

STEP 1: Is this geopolitically significant? (BE STRICT)

Set is_geopolitical=FALSE for:
- Local/domestic news (crime, courts, local politics unless it's a national crisis)
- Entertainment, sports, celebrities, lifestyle, weather, health tips
- Historical articles, retrospectives, anniversaries, documentaries
- Routine government operations (budget meetings, routine patrols, standard procedures)
- Business news unless it involves sanctions, trade wars, or major economic policy
- Local protests unless they're nationwide or internationally significant
- Opinion pieces, analysis without new events, "what if" articles

Set is_geopolitical=TRUE ONLY for:
- Active military operations, strikes, invasions, defense deployments
- International diplomacy: summits, treaties, sanctions, UN actions
- Major economic actions: sanctions, trade wars, currency crises, market crashes
- Significant civil unrest: nationwide protests, coups, mass riots
- Elections ONLY if contested, controversial, or with international implications
- Terrorism, assassinations of political figures
- Nuclear/WMD developments
- Border disputes, territorial claims

When in doubt, set is_geopolitical=FALSE. Quality over quantity.

STEP 2: Location name (coordinates are handled separately)
- Identify WHERE the event occurred (not where it was reported from)
- Use the most specific location: "Kyiv, Ukraine" not just "Ukraine"
- For airstrikes/attacks, use the TARGET location
- Use standard naming: "Tehran, Iran" not "Teheran", "Kyiv" not "Kiev"
- For nationwide events, use the capital: "Tehran, Iran" for Iran protests

STEP 3: Categorization
- MILITARY: Armed forces, weapons, airstrikes, invasions, defense systems
- DIPLOMACY: Treaties, summits, sanctions announcements, UN/NATO actions
- ECONOMY: Trade wars, sanctions impact, currency crises, major policy shifts
- UNREST: Mass protests, coups, civil disorder, political violence

STEP 4: Severity (1-10) - BE CONSERVATIVE
1-3: Should rarely be used. If severity is this low, consider is_geopolitical=false
4-5: Notable but contained; single country affected
6-7: Significant; regional implications or international attention
8-9: Major crisis; multiple countries involved, international response
10: Extremely rare; war declarations, nuclear events, regime changes

STEP 5: Summary
- summary: One factual sentence describing what happened (FACTS ONLY, no predictions)

Return valid JSON matching the schema. Do NOT include latitude/longitude - those are handled separately."""


SYNTHESIS_PROMPT = """<role>
You explain geopolitical news to regular people - what happened, why it matters, and what could happen next.
</role>

<instructions>
From the news reports provided, synthesize:
1. TITLE: Single headline, under 100 characters, factual
2. SUMMARY: What happened (2-3 sentences, prioritize WIRE SERVICE sources)
3. FALLOUT: Why it matters to regular people (2-3 sentences, see requirements below)
4. SEVERITY: Score 1-10 based on verified facts only
</instructions>

<fallout_requirements>
The FALLOUT section must help someone understand: "Why should I care about this?"

REQUIRED elements:
- CONTEXT: What do most people not know? (e.g., "Taiwan makes 90% of advanced chips")
- STAKES: What could realistically happen next? Include timeframes when possible.
- CONNECTION: How might this touch daily life? Name specific things: products, prices, travel, companies.

QUALITY CHECK before finalizing:
- Does this read like a news explainer, not an academic paper?
- Would a curious non-expert understand it?
- Are there specific, concrete details (not just "economic impact" or "regional tensions")?
</fallout_requirements>

<examples>
INPUT: China military exercises near Taiwan
GOOD_FALLOUT: "Taiwan's TSMC produces 90% of the world's advanced chips - they're in everything from iPhones to car computers. If exercises escalate to a blockade, global electronics shortages could start within weeks. Watch for: chip stockpiling announcements, US carrier movements, or airlines rerouting flights."
BAD_FALLOUT: "This could destabilize the region and impact global trade relations. International observers are monitoring the situation."

The first is specific (TSMC, iPhones, weeks, what to watch). The second is generic filler.
</examples>

<source_credibility>
Sources are labeled by tier. When facts conflict, prefer higher tiers:
WIRE SERVICE (AP, Reuters, AFP, BBC) > QUALITY OUTLET (NYT, Guardian) > REGIONAL > UNVERIFIED
</source_credibility>

Return valid JSON matching the schema."""


# ---------------------------------------------------------------------------
# Geocoding - Dedicated step for accurate coordinate extraction
# ---------------------------------------------------------------------------

# Cache location context at module load (used in geocoding prompt)
_LOCATION_CONTEXT = get_location_prompt_context()

GEOCODING_PROMPT = f"""You are a geocoding expert. Your ONLY task is to convert a location name to coordinates.

You have a reference dictionary of known geopolitical locations below. Your job:

1. If the location EXACTLY matches a reference entry → use those coordinates
2. If the location is SIMILAR to a reference entry (spelling variant, abbreviation) → use the reference coordinates
3. If the location is a specific place WITHIN a referenced area → estimate based on the reference
4. If no good reference exists → estimate using your geographic knowledge

CRITICAL RULES:
- Middle East is around (45, 29) NOT in Canada/Atlantic
- Qatar's Al Udeid Air Base is at (51.17, 25.12) NOT in the USA
- Double-check hemisphere: Middle East/Asia = positive longitude, Americas = negative longitude
- Return coordinates as (longitude, latitude) - longitude first!

{_LOCATION_CONTEXT}

Given a location name, return the coordinates and confidence level.
- confidence "exact": matched a reference entry exactly
- confidence "nearby": location is near/within a reference area
- confidence "estimated": no good reference, used general knowledge"""


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
    client: genai.Client,
    location_name: str,
    article_context: str = "",
    max_retries: int = 2,
) -> GeocodedLocation | None:
    """
    Geocode a location using the LLM (when dictionary/cache miss).
    
    This is a focused, single-task LLM call for maximum accuracy.
    Uses the full location reference dictionary in the prompt.
    
    Args:
        client: Gemini client
        location_name: The location to geocode (e.g., "Tehran, Iran")
        article_context: Optional article snippet for disambiguation
        max_retries: Number of retries on failure
    
    Returns:
        GeocodedLocation with coordinates, or None on failure
    """
    prompt_content = f"{GEOCODING_PROMPT}\n\nLocation to geocode: {location_name}"
    if article_context:
        prompt_content += f"\n\nContext from article: {article_context[:200]}"
    
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL_ENRICHMENT,  # Use the same lite model
                contents=prompt_content,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=GeocodedLocation,
                ),
            )
            
            if response.text:
                geocoded = GeocodedLocation.model_validate_json(response.text)
                return geocoded
                
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
            # Log but don't fail - we'll fall back to (0, 0)
            print(f"      ⚠️ LLM geocoding failed for '{location_name}': {type(e).__name__}")
    
    return None


async def geocode_enriched_articles(
    client: genai.Client,
    enriched_articles: list[tuple[dict, EnrichedArticle]],
) -> list[tuple[dict, EnrichedArticle]]:
    """
    Batch geocode all enriched articles that passed the geopolitical filter.
    
    Uses a 3-tier lookup strategy:
    1. Local dictionary (instant, no API call)
    2. Redis cache (fast, no API call)
    3. LLM geocoding (slow, costs API credits - results cached)
    
    Updates the latitude/longitude fields of each EnrichedArticle.
    """
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
        cached = get_cached_geocodes_batch(need_cache_check)
        
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
            geocoded = await geocode_location_llm(client, loc_name)
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
            cache_geocodes_batch(new_cache_entries)
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


class QuotaExhaustedError(Exception):
    """Raised when Gemini API quota is exhausted."""
    pass


class GeminiAuthenticationError(Exception):
    """Raised when Gemini API key is invalid."""
    pass


async def check_gemini_quota(client: genai.Client) -> None:
    """
    Pre-flight check to verify Gemini API is available before processing.
    
    Makes a minimal API call to check if:
    1. API key is valid
    2. Account has available quota
    
    Raises:
        QuotaExhaustedError: If quota is exhausted
        GeminiAuthenticationError: If API key is invalid
    """
    print("\n🔑 Checking Gemini API availability...")
    try:
        # Minimal request to check quota
        await asyncio.to_thread(
            client.models.generate_content,
            model=MODEL_ENRICHMENT,
            contents="hi",
            config=types.GenerateContentConfig(max_output_tokens=10),
        )
        print("   ✓ Gemini API is available")
    except Exception as e:
        error_msg = str(e).lower()
        if "api_key" in error_msg or "invalid" in error_msg or "401" in str(e):
            print("   ❌ Gemini API key invalid!")
            raise GeminiAuthenticationError(
                "Gemini API key is invalid. Check your GEMINI_API_KEY."
            ) from e
        if "quota" in error_msg or "resource_exhausted" in error_msg or "429" in str(e):
            print("   ❌ Gemini quota exhausted!")
            raise QuotaExhaustedError(
                "Gemini API quota exhausted. Check your Google AI Studio billing."
            ) from e
        raise


async def enrich_article(
    client: genai.Client, 
    article: dict, 
    index: int, 
    total: int,
    max_retries: int = 3,
) -> tuple[dict, EnrichedArticle | None]:
    """
    Use Gemini Flash-Lite to extract structured geopolitical data from an article.
    Returns tuple of (original_article, enriched_data or None).
    
    Uses the lighter model for cost efficiency on high-volume enrichment.
    Includes retry logic for rate limits with exponential backoff.
    """
    title = article.get("title", "")
    description = article.get("description", "")
    content = article.get("content", "")
    
    # Combine available text
    article_text = f"Title: {title}\nDescription: {description}"
    if content:
        article_text += f"\nContent: {content[:500]}"
    
    last_error = None
    for attempt in range(max_retries):
        try:
            # Use Gemini with JSON schema for structured output
            # Include current date context to avoid outdated political references
            date_context = _get_current_date_context()
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL_ENRICHMENT,  # Flash-Lite for enrichment
                contents=f"{date_context}\n\n{ENRICHMENT_PROMPT}\n\nArticle:\n{article_text}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=EnrichedArticle,
                ),
            )
            
            # Parse the JSON response
            response_text = response.text
            if not response_text:
                print(f"  ⚠️ [{index+1}/{total}] Empty response: {title[:40]}...")
                return (article, None)
            
            enriched = EnrichedArticle.model_validate_json(response_text)
            
            if enriched.is_geopolitical:
                print(f"  ✓ [{index+1}/{total}] {enriched.category} | {title[:50]}...")
            else:
                print(f"  ↳ [{index+1}/{total}] Skipped: {title[:50]}...")
            
            return (article, enriched)
            
        except Exception as e:
            last_error = e
            error_msg = str(e).lower()
            
            # Check for quota/rate limit errors
            if "quota" in error_msg or "resource_exhausted" in error_msg or "429" in str(e):
                wait_time = (2 ** attempt) * 5  # 5s, 10s, 20s
                print(f"  ⏳ [{index+1}/{total}] Rate limited, waiting {wait_time}s... (attempt {attempt+1}/{max_retries})")
                await asyncio.sleep(wait_time)
                continue
            
            # JSON parsing errors - likely malformed response
            if "validation" in error_msg or "json" in error_msg:
                if attempt < max_retries - 1:
                    print(f"  ⚠️ [{index+1}/{total}] Parse error, retrying: {type(e).__name__}")
                    await asyncio.sleep(1)
                    continue
            
            # Other errors
            if attempt < max_retries - 1:
                print(f"  ⚠️ [{index+1}/{total}] API error, retrying: {type(e).__name__}")
                await asyncio.sleep(2)
                continue
            
            error_detail = str(e)[:150] if str(e) else "No details"
            print(f"  ⚠️ [{index+1}/{total}] Failed: {title[:40]}... ({type(e).__name__})")
            print(f"      Error: {error_detail}")
            return (article, None)
    
    # All retries exhausted
    print(f"  ❌ [{index+1}/{total}] Rate limit exceeded after {max_retries} retries")
    return (article, None)


def _get_credibility_label(score: int) -> str:
    """Convert credibility score to human-readable label."""
    if score >= 3:
        return "WIRE SERVICE"
    elif score >= 2:
        return "QUALITY OUTLET"
    elif score >= 1:
        return "REGIONAL"
    else:
        return "UNVERIFIED"


async def synthesize_incident(
    client: genai.Client,
    sources: list[EventSource],
    location_name: str = "",
) -> SynthesizedEvent | None:
    """
    Synthesize a unified event from multiple sources about the same incident.
    Prioritizes credible sources in the synthesis.
    
    Uses the full Flash model (not Lite) for better reasoning on:
    - Fallout predictions
    - Multi-source reconciliation
    - Quality synthesis
    
    Always generates fallout prediction, even for single-source events.
    Includes timeout to prevent hanging.
    """
    
    # Sort by credibility (highest first), then by timestamp (earliest first for tie-breaking)
    def source_sort_key(s: EventSource) -> tuple[int, str]:
        cred = get_source_credibility(s.source_name)
        return (-cred, s.timestamp)  # Negative credibility so higher sorts first
    
    sorted_sources = sorted(sources, key=source_sort_key)
    
    # Build the timeline with credibility labels
    timeline_parts = []
    for i, s in enumerate(sorted_sources):
        cred = get_source_credibility(s.source_name)
        label = _get_credibility_label(cred)
        timeline_parts.append(
            f"{i+1}. [{s.source_name}] ({label}) {s.timestamp}\n   Headline: {s.headline}\n   Summary: {s.summary}"
        )
    timeline = "\n".join(timeline_parts)
    
    try:
        # Use asyncio.wait_for with 60 second timeout
        # Using full Flash model for quality synthesis
        # Include current date context to avoid outdated political references
        date_context = _get_current_date_context()
        async def _generate():
            return await asyncio.to_thread(
                client.models.generate_content,
                model=MODEL_SYNTHESIS,  # Full Flash for synthesis quality
                contents=f"{date_context}\n\n{SYNTHESIS_PROMPT}\n\nNews reports about the same incident:\n\n{timeline}",
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SynthesizedEvent,
                ),
            )
        
        response = await asyncio.wait_for(_generate(), timeout=60.0)
        
        response_text = response.text
        if not response_text:
            raise ValueError("Empty response")
        
        synthesized = SynthesizedEvent.model_validate_json(response_text)
        print(f"  ✓ Synthesized: {location_name} ({len(sources)} sources)")
        return synthesized
        
    except asyncio.TimeoutError:
        print(f"  ⚠️ Synthesis timeout: {location_name}")
        src = sorted_sources[0]
        return SynthesizedEvent(
            title=src.headline,
            summary=src.summary,
            fallout_prediction="",
            severity=5,
        )
    except Exception as e:
        # Log detailed error info for debugging
        error_detail = str(e)[:200] if str(e) else "No details"
        print(f"  ⚠️ Synthesis failed ({location_name}): {type(e).__name__}")
        print(f"      Error: {error_detail}")
        if 'response_text' in dir() and response_text:
            print(f"      Response preview: {response_text[:150]}...")
        # Fallback to first source
        src = sorted_sources[0]
        return SynthesizedEvent(
            title=src.headline,
            summary=src.summary,
            fallout_prediction="",
            severity=5,
        )


# ---------------------------------------------------------------------------
# Incident Grouping
# ---------------------------------------------------------------------------

def are_same_incident(
    a_category: str, a_lng: float, a_lat: float, a_time: str,
    b_category: str, b_lng: float, b_lat: float, b_time: str,
) -> bool:
    """
    Check if two articles are about the same incident.
    Criteria: same category, within category-specific distance, within 12 hours.
    MILITARY uses tighter radius (~10km) to avoid merging distinct strikes.
    """
    # Must be same category
    if a_category != b_category:
        return False
    
    # Must be within distance threshold (category-specific)
    max_distance = get_grouping_distance(a_category)
    distance = math.sqrt((a_lng - b_lng) ** 2 + (a_lat - b_lat) ** 2)
    if distance > max_distance:
        return False
    
    # Must be within time threshold
    a_dt = datetime.fromisoformat(a_time.replace("Z", "+00:00"))
    b_dt = datetime.fromisoformat(b_time.replace("Z", "+00:00"))
    hours_diff = abs((a_dt - b_dt).total_seconds()) / 3600
    if hours_diff > GROUPING_TIME_HOURS:
        return False
    
    return True


class IncidentGroup:
    """Groups enriched articles that belong to the same incident"""
    def __init__(self, category: str, lng: float, lat: float, location_name: str):
        self.category = category
        self.lng = lng
        self.lat = lat
        self.location_name = location_name
        self.sources: list[EventSource] = []
        self.severities: list[int] = []
        # NOTE: fallout_predictions removed - only comes from synthesis step
    
    def add_source(
        self, 
        source: EventSource, 
        severity: int,
        lng: float,
        lat: float,
    ):
        self.sources.append(source)
        self.severities.append(severity)
        # Update coordinates to centroid
        n = len(self.sources)
        self.lng = ((self.lng * (n - 1)) + lng) / n
        self.lat = ((self.lat * (n - 1)) + lat) / n
    
    def matches(self, category: str, lng: float, lat: float, timestamp: str) -> bool:
        """Check if an article belongs to this incident group"""
        if not self.sources:
            return False
        
        # Must be same category
        if self.category != category:
            return False
        
        # Must be within distance threshold (category-specific)
        max_distance = get_grouping_distance(self.category)
        distance = math.sqrt((self.lng - lng) ** 2 + (self.lat - lat) ** 2)
        if distance > max_distance:
            return False
        
        # Time check: article must be within GROUPING_TIME_HOURS of ANY existing source
        # This allows the incident window to expand as new articles arrive
        try:
            article_dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return False
        
        for source in self.sources:
            try:
                source_dt = datetime.fromisoformat(source.timestamp.replace("Z", "+00:00"))
                hours_diff = abs((article_dt - source_dt).total_seconds()) / 3600
                if hours_diff <= GROUPING_TIME_HOURS:
                    return True
            except (ValueError, AttributeError):
                continue
        
        return False
    
    def get_timestamps(self) -> tuple[str, str]:
        """Get earliest and latest timestamps"""
        times = sorted(s.timestamp for s in self.sources)
        return times[0], times[-1]
    
    def get_max_severity(self) -> int:
        """Get the highest severity from all sources"""
        return max(self.severities) if self.severities else 5


def group_by_incident(
    enriched_articles: list[tuple[dict, EnrichedArticle]]
) -> list[IncidentGroup]:
    """
    Group enriched articles by incident based on category, location, and time.
    Filters out sources with negative credibility (known unreliable).
    """
    groups: list[IncidentGroup] = []
    filtered_count = 0
    
    for article, enriched in enriched_articles:
        source_info = article.get("source", {})
        source_name = source_info.get("name") if isinstance(source_info, dict) else "Unknown"
        source_url = article.get("url", "")
        title = article.get("title", "No title")
        timestamp = article.get("publishedAt", datetime.now(timezone.utc).isoformat())
        
        # Filter out unreliable sources
        credibility = get_source_credibility(source_name)
        if credibility < 0:
            filtered_count += 1
            continue
        
        source = EventSource(
            id=generate_source_id(title, source_url),
            headline=title,
            summary=enriched.summary,
            source_name=source_name or "Unknown",
            source_url=source_url or "",
            timestamp=timestamp,
        )
        
        # Find matching group
        matched_group = None
        for group in groups:
            if group.matches(enriched.category, enriched.longitude, enriched.latitude, timestamp):
                matched_group = group
                break
        
        if matched_group:
            matched_group.add_source(
                source, 
                enriched.severity,
                enriched.longitude,
                enriched.latitude,
            )
        else:
            # Create new group
            new_group = IncidentGroup(
                category=enriched.category,
                lng=enriched.longitude,
                lat=enriched.latitude,
                location_name=enriched.location_name,
            )
            new_group.add_source(
                source, 
                enriched.severity,
                enriched.longitude,
                enriched.latitude,
            )
            groups.append(new_group)
    
    if filtered_count > 0:
        print(f"⚠️ Filtered {filtered_count} articles from unreliable sources")
    
    return groups


# ---------------------------------------------------------------------------
# Main Processing Pipeline
# ---------------------------------------------------------------------------

def _get_article_hash(article: dict) -> str:
    """Generate a hash for an article to check if already processed."""
    title = article.get("title", "")
    url = article.get("url", "")
    return generate_source_id(title, url)


async def process_articles(
    articles: list[dict], 
    gemini_client: genai.Client
) -> list[GeoEvent]:
    """
    Process articles: enrich, group by incident, synthesize.
    Uses Redis cache to skip already-processed articles (saves API credits).
    """
    # Step 0: Filter out already-processed articles (saves API credits!)
    article_hashes = {_get_article_hash(a): a for a in articles}
    already_processed = get_processed_articles_batch(list(article_hashes.keys()))
    
    new_articles = [
        a for h, a in article_hashes.items() 
        if h not in already_processed
    ]
    
    skipped = len(articles) - len(new_articles)
    if skipped > 0:
        print(f"⏭️  Skipped {skipped} already-processed articles (cached)")
    
    if not new_articles:
        print("📭 No new articles to process")
        return []
    
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    async def bounded_enrich(article: dict, index: int) -> tuple[dict, EnrichedArticle | None]:
        async with semaphore:
            return await enrich_article(gemini_client, article, index, len(new_articles))
    
    # Step 1: Enrich only NEW articles in parallel
    tasks = [bounded_enrich(article, i) for i, article in enumerate(new_articles)]
    results = await asyncio.gather(*tasks)
    
    # Mark all processed articles in cache (even non-geopolitical ones)
    processed_hashes = [_get_article_hash(a) for a, _ in results]
    mark_articles_processed_batch(processed_hashes)
    
    # Filter to geopolitical events only
    enriched_articles = [
        (article, enriched)
        for article, enriched in results
        if enriched is not None and enriched.is_geopolitical
    ]

    print(f"\n📊 {len(enriched_articles)} geopolitical articles identified")

    # Step 2: Geocode locations (dedicated step for accuracy)
    enriched_articles = await geocode_enriched_articles(gemini_client, enriched_articles)

    # Step 3: Group by incident
    incident_groups = group_by_incident(enriched_articles)
    print(f"🔗 Grouped into {len(incident_groups)} incidents")
    
    # Log source distribution
    multi_source = [g for g in incident_groups if len(g.sources) > 1]
    if multi_source:
        print(f"   ({len(multi_source)} incidents with multiple sources)")
        for g in multi_source:
            print(f"      • {g.category} @ {g.location_name}: {len(g.sources)} sources")
    
    # Step 3: Synthesize ALL incidents (title, summary, fallout)
    # Flash-Lite only extracts facts; Flash generates analysis/predictions
    print(f"\n🔄 Synthesizing {len(incident_groups)} incidents (title + fallout)...")
    
    synthesis_tasks = [
        synthesize_incident(gemini_client, g.sources, g.location_name)
        for g in incident_groups
    ]
    
    # Run synthesis in parallel
    if synthesis_tasks:
        synthesis_results = await asyncio.gather(*synthesis_tasks)
    else:
        synthesis_results = []
    
    # Build final events
    events: list[GeoEvent] = []
    
    for i, group in enumerate(incident_groups):
        earliest, latest = group.get_timestamps()
        synthesized = synthesis_results[i] if i < len(synthesis_results) else None
        
        if synthesized:
            title = synthesized.title
            summary = synthesized.summary
            severity = synthesized.severity
            fallout = synthesized.fallout_prediction
        else:
            # Fallback if synthesis failed
            src = group.sources[0]
            title = src.headline
            summary = src.summary
            severity = group.get_max_severity()
            fallout = ""  # No fallout without synthesis
        
        # Generate incident ID
        incident_id = generate_incident_id(
            group.category, group.lng, group.lat, earliest
        )
        
        # Extract geographic region for notification filtering
        region = get_region(group.location_name)
        
        event = GeoEvent(
            id=incident_id,
            title=title,
            category=group.category,
            coordinates=(group.lng, group.lat),
            location_name=group.location_name,
            region=region,
            severity=severity,
            summary=summary,
            timestamp=earliest,
            last_updated=latest,
            fallout_prediction=fallout,
            sources=group.sources,
        )
        events.append(event)
    
    return events


# ---------------------------------------------------------------------------
# Output Writers with Source Merging
# ---------------------------------------------------------------------------

def retention_score(event: dict) -> datetime:
    """
    Calculate retention score for an event.
    
    Higher severity events get a time bonus, making them sort higher
    and stay in the dataset longer even if they haven't been updated recently.
    """
    timestamp = event.get("last_updated", event["timestamp"])
    dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    severity = event.get("severity", 5)
    bonus_hours = SEVERITY_BONUS_HOURS.get(severity, 0)
    return dt + timedelta(hours=bonus_hours)


def _find_similar_existing_event(
    new_event: dict,
    existing_events: dict[str, dict],
    distance_threshold: float = 1.0,  # ~100km
    time_hours: int = 24,
) -> dict | None:
    """
    Find an existing event that's similar enough to merge with.
    Uses category + location + time proximity.
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
    new_events: list[GeoEvent], 
    existing_data: list[dict],
    gemini_client: genai.Client | None = None,
) -> list[dict]:
    """
    Merge new events with existing events, adding sources to matching incidents.
    Re-synthesizes title/summary when new sources are added.
    
    Matching is done by:
    1. Exact ID match (fastest)
    2. Category + location + time proximity (catches centroid drift)
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
            existing = _find_similar_existing_event(event_dict, existing_by_id)
        
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
                synthesize_incident(gemini_client, sources, event.get("location_name", ""))
            )
        
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
    # High-severity events get a time bonus, keeping them longer
    all_events = sorted(
        existing_by_id.values(),
        key=retention_score,
        reverse=True
    )
    
    # Keep top events by retention score
    final_events = all_events[:MAX_EVENTS]
    
    if merged_count > 0:
        print(f"🔗 Merged {merged_count} incidents with existing events")
    if new_count > 0:
        print(f"✨ Added {new_count} new incidents")
    
    return final_events


async def write_local(events: list[GeoEvent], path: Path, gemini_client: genai.Client) -> None:
    """Write events to local JSON file, merging with existing events."""
    import shutil
    
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
    final_events = await merge_with_existing(events, existing_data, gemini_client)
    
    with open(path, "w") as f:
        json.dump(final_events, f, indent=2)
    
    total_sources = sum(len(e.get("sources", [])) for e in final_events)
    print(f"💾 Wrote {len(final_events)} incidents ({total_sources} total sources) to {path}")


async def write_gcs(events: list[GeoEvent], bucket_name: str, gemini_client: genai.Client) -> None:
    """Write events to Google Cloud Storage."""
    from google.cloud import storage
    
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob("events.json")
    
    # First download existing and merge
    try:
        existing_data = json.loads(blob.download_as_text())
    except Exception:
        existing_data = []
    
    final_events = await merge_with_existing(events, existing_data, gemini_client)
    
    blob.upload_from_string(
        json.dumps(final_events, indent=2),
        content_type="application/json"
    )
    
    total_sources = sum(len(e.get("sources", [])) for e in final_events)
    print(f"☁️  Wrote {len(final_events)} incidents ({total_sources} total sources) to gs://{bucket_name}/events.json")


# ---------------------------------------------------------------------------
# Push Notification Integration
# ---------------------------------------------------------------------------

def send_push_notification(event: dict) -> bool:
    """
    Send push notification for an event to the API.
    
    The API handles per-subscription deduplication, ensuring each subscriber
    only receives each event once, even if this function is called multiple times.
    User-defined rules filter which events each subscriber receives.
    
    Args:
        event: Event dict with id, title, summary, severity, category, timestamp
        
    Returns:
        True if sent successfully, False otherwise
    """
    import requests
    from datetime import datetime, timezone
    
    if not PUSH_API_SECRET:
        print("   ⚠️ PUSH_API_SECRET not set, skipping notification")
        return False
    
    event_id = event.get("id", "")
    severity = event.get("severity", 0)
    
    # Basic severity filter - user rules handle granular filtering
    if severity < PUSH_NOTIFICATION_THRESHOLD:
        return False
    
    # Check article age - only notify for recent news
    sources = event.get("sources", [])
    if sources:
        latest_source = max(sources, key=lambda s: s.get("timestamp", ""))
        timestamp_str = latest_source.get("timestamp", event.get("timestamp", ""))
    else:
        timestamp_str = event.get("timestamp", "")
    
    if timestamp_str:
        try:
            if timestamp_str.endswith("Z"):
                timestamp_str = timestamp_str[:-1] + "+00:00"
            event_time = datetime.fromisoformat(timestamp_str)
            if event_time.tzinfo is None:
                event_time = event_time.replace(tzinfo=timezone.utc)
            
            age_hours = (datetime.now(timezone.utc) - event_time).total_seconds() / 3600
            
            if age_hours > PUSH_MAX_AGE_HOURS:
                print(f"   ⏭️ Skipping old event ({age_hours:.1f}h old): {event.get('title', '')[:40]}...")
                return False
        except (ValueError, TypeError) as e:
            print(f"   ⚠️ Could not parse timestamp '{timestamp_str}': {e}")
    
    # Mark if this is a critical event
    is_critical = severity >= PUSH_CRITICAL_THRESHOLD
    
    # Get region for rule-based filtering (extract if not present)
    region = event.get("region")
    if not region:
        region = get_region(event.get("location_name", ""))
    
    # Count sources for multi-source confirmation rules
    sources = event.get("sources", [])
    sources_count = len(sources) if sources else 1
    
    # Notification format: "Realpolitik" as title, headline as body
    headline = event.get("title", "Breaking news")
    if len(headline) > 200:
        headline = headline[:197] + "..."
    
    payload = {
        "title": "Realpolitik",
        "body": headline,
        "url": f"/?event={event_id}",
        "id": event_id,
        "severity": severity,
        "category": event.get("category"),
        "region": region,
        "location_name": event.get("location_name", ""),
        "sources_count": sources_count,
        "critical": is_critical,
    }
    
    try:
        response = requests.post(
            PUSH_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {PUSH_API_SECRET}",
                "Content-Type": "application/json",
                # Bypass Vercel firewall protection on preview/development deployments
                "x-vercel-protection-bypass": PUSH_API_SECRET,
            },
            timeout=10,
        )
        
        if response.ok:
            result = response.json()
            critical_tag = " 🚨 CRITICAL" if is_critical else ""
            print(f"   🔔 Push sent{critical_tag}: {result.get('sent', 0)} delivered, {result.get('failed', 0)} failed")
            return True
        else:
            print(f"   ⚠️ Push failed: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ⚠️ Push error: {type(e).__name__}: {e}")
        return False


def notify_high_severity_events(events: list[dict]) -> int:
    """
    Check events and send push notifications for significant ones.
    
    The API handles per-subscription deduplication, ensuring each subscriber
    only receives each event once. User-defined rules control which events
    each subscriber receives based on severity, category, region, etc.
    
    Args:
        events: List of event dicts to check
        
    Returns:
        Number of notifications sent
    """
    print("\n" + "=" * 60)
    print("📲 PUSH NOTIFICATIONS")
    print("=" * 60)
    print(f"   API URL: {PUSH_API_URL}")
    print(f"   Secret configured: {'✓' if PUSH_API_SECRET else '✗ MISSING'}")
    print(f"   Severity threshold: {PUSH_NOTIFICATION_THRESHOLD}+ (critical: {PUSH_CRITICAL_THRESHOLD}+)")
    print(f"   Max age: {PUSH_MAX_AGE_HOURS} hours")
    print(f"   Events to check: {len(events)}")
    
    if not PUSH_API_SECRET:
        print("   ⚠️ PUSH_API_SECRET not set - skipping all notifications")
        return 0
    
    notified_count = 0
    
    # Count eligible events by severity tier
    eligible = [e for e in events if e.get("severity", 0) >= PUSH_NOTIFICATION_THRESHOLD]
    critical = [e for e in eligible if e.get("severity", 0) >= PUSH_CRITICAL_THRESHOLD]
    print(f"   🎯 Events at severity {PUSH_NOTIFICATION_THRESHOLD}+: {len(eligible)} ({len(critical)} critical)")
    
    # Sort by severity descending so critical events are processed first
    sorted_events = sorted(
        eligible,
        key=lambda e: e.get("severity", 0),
        reverse=True
    )
    
    for event in sorted_events:
        severity = event.get("severity", 0)
        title = event.get("title", "Unknown")[:50]
        is_critical = severity >= PUSH_CRITICAL_THRESHOLD
        critical_tag = "🚨" if is_critical else "📍"
        print(f"\n   {critical_tag} [{severity}] {title}...")
        
        if send_push_notification(event):
            notified_count += 1
    
    # Summary
    print(f"\n   {'─' * 40}")
    print(f"   📊 PUSH SUMMARY: {notified_count} sent, {len(eligible) - notified_count} skipped")
    
    return notified_count


async def write_r2(events: list[GeoEvent], gemini_client: genai.Client) -> None:
    """Write events to Cloudflare R2 (S3-compatible storage)."""
    import boto3
    
    endpoint_url = os.getenv("R2_ENDPOINT_URL")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("R2_BUCKET_NAME")
    
    if not all([endpoint_url, access_key, secret_key, bucket_name]):
        raise ValueError("R2 environment variables not fully configured")
    
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
    )
    
    # Download existing events and merge
    existing_data = []
    try:
        response = s3.get_object(Bucket=bucket_name, Key="events.json")
        existing_data = json.loads(response["Body"].read().decode("utf-8"))
        
        # SAFETY NET: Backup current events.json before overwriting
        print("💾 Backing up current events.json...")
        try:
            s3.copy_object(
                Bucket=bucket_name,
                CopySource=f"{bucket_name}/events.json",
                Key="events-backup.json",
            )
        except Exception as backup_err:
            print(f"⚠️ Backup failed: {type(backup_err).__name__}")
    except Exception as e:
        if "NoSuchKey" in str(type(e).__name__) or "404" in str(e):
            print("📄 No existing events.json found, starting fresh")
        else:
            print(f"⚠️ Could not load existing events: {type(e).__name__}")
    
    final_events = await merge_with_existing(events, existing_data, gemini_client)
    
    # Upload merged events
    s3.put_object(
        Bucket=bucket_name,
        Key="events.json",
        Body=json.dumps(final_events, indent=2),
        ContentType="application/json",
    )
    
    total_sources = sum(len(e.get("sources", [])) for e in final_events)
    print(f"☁️  Wrote {len(final_events)} incidents ({total_sources} total sources) to R2")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def fetch_hybrid_articles(
    newsapi_key: str,
    sources: str = "all"
) -> list[dict]:
    """
    Fetch articles from multiple sources:
    - Primary: RSS feeds (real-time, unlimited)
    - Backup: NewsAPI (gap-filling, rate-limited)
    
    Args:
        newsapi_key: API key for NewsAPI
        sources: Which sources to fetch - "rss", "newsapi", or "all"
    
    Returns deduplicated article list.
    """
    all_articles: list[dict] = []
    
    # RSS Feeds (real-time, free, fast-updating)
    if sources in ("rss", "all"):
        print("\n📡 Fetching from RSS feeds...")
        try:
            # For RSS-only runs, use shorter lookback to avoid reprocessing
            max_age = 3 if sources == "rss" else 12
            rss_articles = fetch_rss_articles(max_age_hours=max_age, max_per_feed=25)
            all_articles.extend(rss_articles)
        except Exception as e:
            print(f"  ⚠️ RSS fetch error: {type(e).__name__}: {e}")
    
    # NewsAPI (complementary source - 24hr delay but broader coverage)
    # Free tier: 100 req/day, we run 24/day (every hour) = safe margin
    # NewsAPI catches stories from sources not in our RSS feeds
    if sources in ("newsapi", "all") and newsapi_key:
        try:
            print("\n📰 Fetching from NewsAPI (24hr delay, broader sources)...")
            newsapi_articles = await fetch_headlines(newsapi_key, page_size=100)
            all_articles.extend(newsapi_articles)
            print(f"   Added {len(newsapi_articles)} from NewsAPI")
        except Exception as e:
            print(f"  ⚠️ NewsAPI fetch error: {type(e).__name__}: {e}")
    elif sources in ("newsapi", "all") and not newsapi_key:
        print("\n📰 NewsAPI: Skipped (no API key)")
    
    # Deduplicate combined articles
    unique_articles = dedupe_articles(all_articles)
    print(f"\n📊 Total: {len(all_articles)} articles → {len(unique_articles)} after deduplication")
    
    return unique_articles


async def async_main(sources: str = "all"):
    """
    Async main entry point.
    
    Args:
        sources: Which sources to fetch - "rss", "newsapi", or "all"
    """
    import time
    
    print("=" * 60)
    mode_label = {
        "rss": "RSS Only (fast update)",
        "newsapi": "NewsAPI Only",
        "all": "RSS + NewsAPI Hybrid"
    }.get(sources, "RSS + NewsAPI Hybrid")
    print(f"🌍 REALPOLITIK WORKER ({mode_label})")
    print("=" * 60)
    print(f"🤖 AI Models: {MODEL_ENRICHMENT} (enrich) / {MODEL_SYNTHESIS} (synthesis)")
    
    # Validate environment - Gemini is required, NewsAPI is optional backup
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    if sources in ("newsapi", "all") and not NEWSAPI_KEY:
        if sources == "newsapi":
            raise ValueError("NEWSAPI_KEY required for NewsAPI mode")
        print("⚠️ NEWSAPI_KEY not set - running RSS-only mode")
    
    # Initialize Gemini client
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    
    # Pre-flight check: verify Gemini API is available before doing any work
    await check_gemini_quota(gemini_client)
    
    # Fetch articles from specified sources
    articles = await fetch_hybrid_articles(NEWSAPI_KEY, sources=sources)
    
    # Process: enrich, group, synthesize
    print(f"\n🤖 Enriching with Gemini ({MAX_CONCURRENT_REQUESTS} concurrent)...")
    start_time = time.time()
    events = await process_articles(articles, gemini_client)
    elapsed = time.time() - start_time
    
    print(f"\n⏱️  Processing completed in {elapsed:.1f}s")
    
    # Output - write events
    storage_mode = os.getenv("STORAGE_MODE", "local")
    if storage_mode == "r2":
        await write_r2(events, gemini_client)
    elif GCS_BUCKET:
        await write_gcs(events, GCS_BUCKET, gemini_client)
    else:
        await write_local(events, OUTPUT_PATH, gemini_client)
    
    # Send push notifications for high-severity NEW events
    if events:
        # Convert to dicts for notification processing
        event_dicts = [
            e.model_dump() if hasattr(e, 'model_dump') else e
            for e in events
        ]
        notify_high_severity_events(event_dicts)
    else:
        print("\n📲 PUSH NOTIFICATIONS: No events to process")
    
    print("\n✅ Done!")
    print("=" * 60)


def main():
    """Sync wrapper for async main with argument parsing and error handling."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Realpolitik Worker - Fetch and enrich geopolitical news"
    )
    parser.add_argument(
        "--sources",
        choices=["rss", "newsapi", "all"],
        default="all",
        help="Which sources to fetch: rss, newsapi, or all (default)"
    )
    parser.add_argument(
        "--output",
        choices=["local", "gcs", "r2"],
        default=None,
        help="Override output destination (default: auto-detect from env)"
    )
    
    args = parser.parse_args()
    
    # Override storage mode if specified
    if args.output:
        os.environ["STORAGE_MODE"] = args.output
    
    try:
        asyncio.run(async_main(sources=args.sources))
    except QuotaExhaustedError as e:
        print("\n" + "=" * 60)
        print("❌ ERROR: Gemini Quota Exhausted (Pre-flight Check)")
        print("=" * 60)
        print(f"\nDetails: {e}")
        print("\nThe worker detected that your Gemini API quota is exhausted")
        print("BEFORE starting to process articles. No work was done.")
        print("\nAction required:")
        print("  1. Go to https://aistudio.google.com/apikey")
        print("  2. Check your quota and billing settings")
        print("  3. Re-run this workflow")
        print("=" * 60)
        sys.exit(1)
    except GeminiAuthenticationError as e:
        print("\n" + "=" * 60)
        print("❌ ERROR: Gemini Authentication Failed")
        print("=" * 60)
        print(f"\nDetails: {e}")
        print("\nYour Gemini API key is invalid or expired.")
        print("\nAction required:")
        print("  1. Go to https://aistudio.google.com/apikey")
        print("  2. Generate a new API key")
        print("  3. Update the GEMINI_API_KEY secret in GitHub")
        print("=" * 60)
        sys.exit(1)
    except ValueError as e:
        print("\n" + "=" * 60)
        print("❌ ERROR: Configuration Error")
        print("=" * 60)
        print(f"\nDetails: {e}")
        print("\nCheck that all required environment variables are set:")
        print("  - GEMINI_API_KEY")
        print("  - R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL, R2_BUCKET_NAME")
        print("=" * 60)
        sys.exit(1)
    except Exception as e:
        error_msg = str(e).lower()
        print("\n" + "=" * 60)
        
        # Check for quota/rate limit errors in the exception message
        if "quota" in error_msg or "resource_exhausted" in error_msg or "429" in str(e):
            print("❌ ERROR: Gemini Rate Limit / Quota Exceeded")
            print("=" * 60)
            print(f"\nDetails: {e}")
            print("\nPossible causes:")
            print("  1. Too many requests to Gemini API")
            print("  2. Daily quota limit reached")
            print("\nRecommendation: Wait a few minutes and try again.")
        else:
            print("❌ ERROR: Unexpected Error")
            print("=" * 60)
            print(f"\nType: {type(e).__name__}")
            print(f"Details: {e}")
            print("\nPlease check the logs above for more context.")
        
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
