"""
Event models for Cassandra analysis service.
Based on original Argus models but enhanced for microservice use.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional, List
from datetime import datetime


class EventSource(BaseModel):
    """A single news source contributing to an incident."""
    id: str
    headline: str
    summary: str
    source_name: str
    source_url: str
    timestamp: str  # ISO 8601

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: str) -> str:
        """Ensure timestamp is ISO 8601 format."""
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
            return v
        except ValueError:
            # Return current time if invalid
            return datetime.utcnow().isoformat() + "Z"


class SynthesizedEvent(BaseModel):
    """Synthesized event data from multiple sources."""
    title: str = Field(..., description="Single headline capturing the full picture")
    summary: str = Field(..., description="Synthesized summary from all sources")
    fallout_prediction: str = Field(..., description="Enhanced fallout prediction with graph context")
    severity: int = Field(..., description="Severity score 1-10")
    
    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: int) -> int:
        """Ensure severity is within bounds."""
        return max(1, min(10, v))

    @field_validator("title", "summary", "fallout_prediction")
    @classmethod
    def clean_text_fields(cls, v: str) -> str:
        """Clean and validate text fields."""
        if not v or not isinstance(v, str):
            return "No prediction available"
        return v.strip()


class AnalysisContext(BaseModel):
    """Context assembled for enhanced synthesis."""
    primary_events: List[dict] = Field(..., description="Target events being analyzed")
    entity_neighborhood: List[dict] = Field(..., description="Related entities from Neo4j")
    historical_analogues: List[dict] = Field(..., description="Similar events from Qdrant")
    causal_chains: List[dict] = Field(default_factory=list, description="Events that led to current state")
    relationship_graph: dict = Field(..., description="Graph structure for reasoning")
    
    # Context metadata
    assembled_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    context_size_tokens: int = Field(default=0, description="Approximate token count for cost tracking")
    graph_query_time_ms: int = Field(default=0, description="Time spent on graph queries")


class GraphQueryResult(BaseModel):
    """Result from graph database queries."""
    entities: List[dict] = Field(default_factory=list, description="Entity nodes")
    relationships: List[dict] = Field(default_factory=list, description="Edges between entities")
    paths: List[dict] = Field(default_factory=list, description="Important paths for reasoning")
    hub_entities: List[dict] = Field(default_factory=list, description="High-degree nodes")


class VectorSearchResult(BaseModel):
    """Result from vector similarity search."""
    similar_events: List[dict] = Field(default_factory=list, description="Similar historical events")
    similarity_scores: List[float] = Field(default_factory=list, description="Cosine similarity scores")
    metadata: dict = Field(default_factory=dict, description="Search parameters and timing")