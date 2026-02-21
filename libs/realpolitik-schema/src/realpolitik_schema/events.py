"""Event data models for geopolitical events"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from enum import Enum

from pydantic import BaseModel, Field, validator


class EventSeverity(str, Enum):
    """Event severity levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class EventCategory(str, Enum):
    """Event categories"""
    MILITARY = "MILITARY"
    DIPLOMATIC = "DIPLOMATIC"
    ECONOMIC = "ECONOMIC"
    SOCIAL = "SOCIAL"


class EventSource(BaseModel):
    """News source with metadata"""
    id: str = Field(..., description="Unique source identifier")
    name: str = Field(..., description="Source name")
    url: str = Field(..., description="Source URL")
    credibility_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Source credibility 0-1")
    country: Optional[str] = Field(None, description="Source country")
    language: str = Field(default="en", description="Source language")
    type: str = Field(default="rss", description="Source type (rss, api, etc.)")


class GeopoliticalEvent(BaseModel):
    """Core event representation"""
    id: UUID = Field(default_factory=uuid4, description="Unique event identifier")
    title: str = Field(..., min_length=1, max_length=500, description="Event title")
    summary: str = Field(..., min_length=10, max_length=2000, description="Event summary")
    
    category: EventCategory = Field(..., description="Event category")
    severity: EventSeverity = Field(..., description="Event severity level")
    
    # Time information
    occurred_at: datetime = Field(..., description="When the event occurred")
    discovered_at: datetime = Field(default_factory=datetime.utcnow, description="When discovered")
    
    # Location information
    primary_location: str = Field(..., description="Primary location name")
    coordinates: Optional[Dict[str, float]] = Field(
        None,
        description="Geographic coordinates",
        example={"latitude": 48.0159, "longitude": 37.8024}
    )
    
    # Content
    content: str = Field(..., min_length=50, description="Full event content")
    entities: List[str] = Field(default_factory=list, description="Extracted entity names")
    
    # Sources
    sources: List[EventSource] = Field(default_factory=list, description="News sources")
    source_count: int = Field(default=1, ge=1, description="Number of sources")
    
    # Metadata
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Event confidence 0-1")
    tags: List[str] = Field(default_factory=list, description="Event tags")
    
    # Relations
    related_events: List[UUID] = Field(default_factory=list, description="Related event IDs")
    causal_chain: List[UUID] = Field(default_factory=list, description="Causal chain event IDs")
    
    # Status
    status: str = Field(default="active", description="Event status")
    verification_status: str = Field(default="unverified", description="Verification status")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: str,
        }


class EventFilter(BaseModel):
    """Filter parameters for event queries"""
    categories: Optional[List[EventCategory]] = Field(None, description="Filter by categories")
    severities: Optional[List[EventSeverity]] = Field(None, description="Filter by severities")
    locations: Optional[List[str]] = Field(None, description="Filter by locations")
    start_date: Optional[datetime] = Field(None, description="Start date filter")
    end_date: Optional[datetime] = Field(None, description="End date filter")
    
    # Search
    search_query: Optional[str] = Field(None, description="Text search query")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    
    # Pagination
    limit: int = Field(default=50, ge=1, le=100, description="Results limit")
    offset: int = Field(default=0, ge=0, description="Results offset")
    
    # Sorting
    sort_by: str = Field(default="occurred_at", description="Sort field")
    sort_order: str = Field(default="desc", description="Sort order (asc/desc)")
    
    class Config:
        use_enum_values = True