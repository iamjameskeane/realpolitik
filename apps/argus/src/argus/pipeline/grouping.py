"""
Incident grouping logic for clustering related articles.
"""

import math
from datetime import datetime, timezone
from ..models.events import EventSource
from ..models.articles import EnrichedArticle
from ..config import get_source_credibility
from ..utils.hashing import generate_source_id


def are_same_incident(
    a_category: str, a_lng: float, a_lat: float, a_time: str,
    b_category: str, b_lng: float, b_lat: float, b_time: str,
    grouping_distance: float,
    grouping_time_hours: int
) -> bool:
    """
    Check if two articles are about the same incident.
    Criteria: same category, within category-specific distance, within time window.
    """
    # Must be same category
    if a_category != b_category:
        return False
    
    # Must be within distance threshold
    distance = math.sqrt((a_lng - b_lng) ** 2 + (a_lat - b_lat) ** 2)
    if distance > grouping_distance:
        return False
    
    # Must be within time threshold
    a_dt = datetime.fromisoformat(a_time.replace("Z", "+00:00"))
    b_dt = datetime.fromisoformat(b_time.replace("Z", "+00:00"))
    hours_diff = abs((a_dt - b_dt).total_seconds()) / 3600
    if hours_diff > grouping_time_hours:
        return False
    
    return True


class IncidentGroup:
    """Groups enriched articles that belong to the same incident."""
    
    def __init__(self, category: str, lng: float, lat: float, location_name: str):
        self.category = category
        self.lng = lng
        self.lat = lat
        self.location_name = location_name
        self.sources: list[EventSource] = []
        self.severities: list[int] = []
        # Constellation: aggregate entities and relationships from all articles in group
        self.entities: list[dict] = []
        self.relationships: list[dict] = []
        # CAMEO classification (first non-null from group)
        self.cameo_code: str | None = None
        self.cameo_label: str | None = None
    
    def add_source(
        self, 
        source: EventSource, 
        severity: int,
        lng: float,
        lat: float,
        entities: list[dict] | None = None,
        relationships: list[dict] | None = None,
        cameo_code: str | None = None,
        cameo_label: str | None = None,
    ):
        """Add a source to this incident group."""
        self.sources.append(source)
        self.severities.append(severity)
        # Update coordinates to centroid
        n = len(self.sources)
        self.lng = ((self.lng * (n - 1)) + lng) / n
        self.lat = ((self.lat * (n - 1)) + lat) / n
        
        # CAMEO: take first non-null classification
        if cameo_code and not self.cameo_code:
            self.cameo_code = cameo_code
            self.cameo_label = cameo_label
        
        # Aggregate entities (dedupe by name)
        if entities:
            existing_names = {e.get("name") for e in self.entities}
            for entity in entities:
                if entity.get("name") not in existing_names:
                    self.entities.append(entity)
                    existing_names.add(entity.get("name"))
        
        # Aggregate relationships (dedupe by from/to/type)
        if relationships:
            existing_rels = {
                (r.get("from_entity"), r.get("to_entity"), r.get("rel_type")) 
                for r in self.relationships
            }
            for rel in relationships:
                rel_key = (rel.get("from_entity"), rel.get("to_entity"), rel.get("rel_type"))
                if rel_key not in existing_rels:
                    self.relationships.append(rel)
                    existing_rels.add(rel_key)
    
    def matches(
        self,
        category: str,
        lng: float,
        lat: float,
        timestamp: str,
        grouping_distance: float,
        grouping_time_hours: int
    ) -> bool:
        """Check if an article belongs to this incident group."""
        if not self.sources:
            return False
        
        # Must be same category
        if self.category != category:
            return False
        
        # Must be within distance threshold
        distance = math.sqrt((self.lng - lng) ** 2 + (self.lat - lat) ** 2)
        if distance > grouping_distance:
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
                if hours_diff <= grouping_time_hours:
                    return True
            except (ValueError, AttributeError):
                continue
        
        return False
    
    def get_timestamps(self) -> tuple[str, str]:
        """Get earliest and latest timestamps."""
        times = sorted(s.timestamp for s in self.sources)
        return times[0], times[-1]
    
    def get_max_severity(self) -> int:
        """Get the highest severity from all sources."""
        return max(self.severities) if self.severities else 5


def group_by_incident(
    enriched_articles: list[tuple[dict, EnrichedArticle]],
    get_grouping_distance_fn,
    grouping_time_hours: int
) -> list[IncidentGroup]:
    """
    Group enriched articles by incident based on category, location, and time.
    Filters out sources with negative credibility (known unreliable).
    
    Args:
        enriched_articles: List of (raw_article, enriched_data) tuples
        get_grouping_distance_fn: Function that returns distance for a category
        grouping_time_hours: Time window for grouping (hours)
    
    Returns:
        List of IncidentGroup objects
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
        
        # Get grouping distance for this category
        grouping_distance = get_grouping_distance_fn(enriched.category)
        
        # Find matching group
        matched_group = None
        for group in groups:
            if group.matches(
                enriched.category,
                enriched.longitude,
                enriched.latitude,
                timestamp,
                grouping_distance,
                grouping_time_hours
            ):
                matched_group = group
                break
        
        if matched_group:
            matched_group.add_source(
                source, 
                enriched.severity,
                enriched.longitude,
                enriched.latitude,
                entities=enriched.entities,
                relationships=enriched.relationships,
                cameo_code=enriched.cameo_code,
                cameo_label=enriched.cameo_label,
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
                entities=enriched.entities,
                relationships=enriched.relationships,
                cameo_code=enriched.cameo_code,
                cameo_label=enriched.cameo_label,
            )
            groups.append(new_group)
    
    if filtered_count > 0:
        print(f"⚠️ Filtered {filtered_count} articles from unreliable sources")
    
    return groups
