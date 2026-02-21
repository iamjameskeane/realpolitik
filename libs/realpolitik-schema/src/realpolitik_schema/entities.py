"""Entity and relationship data models for knowledge graph"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from enum import Enum

from pydantic import BaseModel, Field, validator


class EntityType(str, Enum):
    """Entity classifications"""
    PERSON = "PERSON"
    ORGANIZATION = "ORGANIZATION"
    COUNTRY = "COUNTRY"
    LOCATION = "LOCATION"
    FACILITY = "FACILITY"
    RESOURCE = "RESOURCE"
    CONCEPT = "CONCEPT"
    EVENT = "EVENT"


class RelationshipType(str, Enum):
    """Relationship types between entities"""
    AFFECTS = "AFFECTS"
    INVOLVES = "INVOLVES"
    LEADS_TO = "LEADS_TO"
    LOCATED_IN = "LOCATED_IN"
    MEMBER_OF = "MEMBER_OF"
    ALLIED_WITH = "ALLIED_WITH"
    OPPOSES = "OPPOSES"
    TRADES_WITH = "TRADES_WITH"
    DEPENDS_ON = "DEPENDS_ON"
    CONTROLS = "CONTROLS"


class Entity(BaseModel):
    """Knowledge graph entity representation"""
    id: str = Field(..., description="Unique entity identifier")
    name: str = Field(..., min_length=1, max_length=200, description="Entity name")
    entity_type: EntityType = Field(..., description="Entity type")
    
    # Entity details
    description: Optional[str] = Field(None, description="Entity description")
    aliases: List[str] = Field(default_factory=list, description="Alternative names")
    
    # Classification
    categories: List[str] = Field(default_factory=list, description="Entity categories")
    tags: List[str] = Field(default_factory=list, description="Entity tags")
    
    # Geographic information
    location: Optional[str] = Field(None, description="Primary location")
    coordinates: Optional[Dict[str, float]] = Field(
        None,
        description="Geographic coordinates"
    )
    
    # Entity properties
    properties: Dict[str, Any] = Field(default_factory=dict, description="Entity properties")
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Entity confidence")
    
    # Relationships
    relationship_count: int = Field(default=0, ge=0, description="Number of relationships")
    centrality_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Graph centrality")
    
    # Status
    status: str = Field(default="active", description="Entity status")
    verification_status: str = Field(default="unverified", description="Verification status")
    
    # Metadata
    first_seen: datetime = Field(default_factory=datetime.utcnow, description="First discovery")
    last_updated: datetime = Field(default_factory=datetime.utcnow, description="Last update")
    
    class Config:
        use_enum_values = True


class Relationship(BaseModel):
    """Entity-to-entity relationship"""
    id: str = Field(..., description="Unique relationship identifier")
    source_entity: str = Field(..., description="Source entity ID")
    target_entity: str = Field(..., description="Target entity ID")
    
    relationship_type: RelationshipType = Field(..., description="Relationship type")
    description: Optional[str] = Field(None, description="Relationship description")
    
    # Relationship properties
    weight: float = Field(default=1.0, ge=0.0, le=1.0, description="Relationship strength")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Relationship confidence")
    
    # Temporal information
    start_date: Optional[datetime] = Field(None, description="Relationship start")
    end_date: Optional[datetime] = Field(None, description="Relationship end")
    is_active: bool = Field(default=True, description="Currently active")
    
    # Evidence
    sources: List[str] = Field(default_factory=list, description="Evidence sources")
    evidence_count: int = Field(default=1, ge=0, description="Number of evidence sources")
    
    # Context
    context: Optional[str] = Field(None, description="Relationship context")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Additional properties")
    
    # Status
    status: str = Field(default="active", description="Relationship status")
    
    class Config:
        use_enum_values = True


class EntityMention(BaseModel):
    """Event-entity association"""
    id: str = Field(..., description="Mention identifier")
    event_id: UUID = Field(..., description="Associated event ID")
    entity_id: str = Field(..., description="Mentioned entity ID")
    
    # Mention details
    text_snippet: str = Field(..., description="Text snippet containing mention")
    start_position: int = Field(..., ge=0, description="Start position in text")
    end_position: int = Field(..., ge=0, description="End position in text")
    
    # Role in event
    mention_type: str = Field(..., description="Type of mention")
    importance_score: float = Field(default=0.5, ge=0.0, le=1.0, description="Mention importance")
    
    # Entity role
    role_in_event: Optional[str] = Field(None, description="Entity's role in event")
    
    # Context
    context: Dict[str, Any] = Field(default_factory=dict, description="Additional context")
    
    # Confidence
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Mention confidence")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    
    class Config:
        json_encoders = {
            UUID: str,
        }


class EntityFilter(BaseModel):
    """Filter parameters for entity queries"""
    entity_types: Optional[List[EntityType]] = Field(None, description="Filter by entity types")
    locations: Optional[List[str]] = Field(None, description="Filter by locations")
    
    # Search
    search_query: Optional[str] = Field(None, description="Text search query")
    name_exact: Optional[str] = Field(None, description="Exact name match")
    
    # Properties
    categories: Optional[List[str]] = Field(None, description="Filter by categories")
    tags: Optional[List[str]] = Field(None, description="Filter by tags")
    
    # Relationship filters
    has_relationships: Optional[bool] = Field(None, description="Must have relationships")
    min_centrality: Optional[float] = Field(None, ge=0.0, le=1.0, description="Minimum centrality")
    
    # Confidence
    min_confidence: float = Field(default=0.0, ge=0.0, le=1.0, description="Minimum confidence")
    
    # Pagination
    limit: int = Field(default=50, ge=1, le=100, description="Results limit")
    offset: int = Field(default=0, ge=0, description="Results offset")
    
    # Sorting
    sort_by: str = Field(default="name", description="Sort field")
    sort_order: str = Field(default="asc", description="Sort order")
    
    class Config:
        use_enum_values = True