"""
Hashing utilities for generating deterministic IDs.
"""

import hashlib
from datetime import datetime


def generate_source_id(title: str, source_url: str | None) -> str:
    """
    Generate a deterministic source ID based on article content.
    Same article = same ID, preventing duplicates across worker runs.
    """
    normalized_title = title.lower().strip() if title else ""
    content = f"{normalized_title}|{source_url or ''}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def generate_incident_id(category: str, lng: float, lat: float, timestamp: str, grouping_distance: float) -> str:
    """
    Generate an incident ID based on category, approximate location, and time window.
    Incidents in the same area/category/time will have the same ID.
    Uses category-specific grouping distance.
    """
    grid_lng = round(lng / grouping_distance) * grouping_distance
    grid_lat = round(lat / grouping_distance) * grouping_distance
    
    # Round time to 12-hour windows
    dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    time_bucket = dt.replace(hour=(dt.hour // 12) * 12, minute=0, second=0, microsecond=0)
    
    content = f"{category}|{grid_lng:.2f}|{grid_lat:.2f}|{time_bucket.isoformat()}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]


def get_article_hash(article: dict) -> str:
    """Generate a hash for an article to check if already processed."""
    title = article.get("title", "")
    url = article.get("url", "")
    return generate_source_id(title, url)
