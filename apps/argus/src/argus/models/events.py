"""
Event models for synthesis and output.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional


class EventSource(BaseModel):
    """A single news source contributing to an incident."""
    id: str
    headline: str
    summary: str
    source_name: str
    source_url: str
    timestamp: str  # ISO 8601


class SynthesizedEvent(BaseModel):
    """Synthesized event data from multiple sources."""
    title: str = Field(..., description="Single headline capturing the full picture (keep under 200 chars)")
    summary: str = Field(..., description="Synthesized summary from all sources (2-3 sentences)")
    fallout_prediction: str = Field(..., description="Prediction based on complete information (2-3 sentences)")
    severity: int = Field(..., description="Severity score 1-10")

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: int) -> int:
        from ..utils.validation import clamp_severity
        return clamp_severity(v)

    @field_validator("title", "summary", "fallout_prediction")
    @classmethod
    def clean_text_fields(cls, v: str) -> str:
        from ..utils.text import clean_text
        return clean_text(v)


class GeoEvent(BaseModel):
    """Final event schema with multiple sources."""
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
    
    # CAMEO classification (optional - null if event doesn't fit taxonomy)
    cameo_code: Optional[str] = Field(default=None, description="CAMEO event code")
    cameo_label: Optional[str] = Field(default=None, description="CAMEO event description")
    
    # Constellation features (populated during enrichment, used by graph processing)
    entities: list[dict] = Field(default_factory=list, description="Extracted entities for knowledge graph")
    relationships: list[dict] = Field(default_factory=list, description="Extracted relationships for knowledge graph")