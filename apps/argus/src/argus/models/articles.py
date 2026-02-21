"""
Article models for enrichment pipeline.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .entities import ExtractedEntity, ExtractedRelationship


class GeminiEnrichmentResponse(BaseModel):
    """Schema for Gemini API response - kept minimal to avoid schema issues.
    
    Note: This model is used specifically for Gemini's response_schema parameter.
    The Gemini API doesn't support additionalProperties in schemas, so we avoid
    using dict or Any types here. Entities/relationships are extracted separately.
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
    cameo_code: Optional[str] = Field(
        default=None,
        description="CAMEO event code (e.g., '190' for military force) or null if not applicable"
    )
    cameo_label: Optional[str] = Field(
        default=None,
        description="CAMEO event description or null if not applicable"
    )


class EnrichedArticle(BaseModel):
    """Full enriched article with all fields including coordinates and entities.
    
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
    # CAMEO classification (optional - null if event doesn't fit CAMEO taxonomy)
    cameo_code: Optional[str] = Field(default=None, description="CAMEO event code or null")
    cameo_label: Optional[str] = Field(default=None, description="CAMEO event description or null")
    
    # Coordinates filled in by geocoding step (not by enrichment)
    latitude: float = Field(default=0.0, description="Filled by geocoding step")
    longitude: float = Field(default=0.0, description="Filled by geocoding step")
    
    # Constellation features (optional - only extracted when enabled)
    entities: list[dict] = Field(default_factory=list, description="Extracted entities (optional)")
    relationships: list[dict] = Field(default_factory=list, description="Extracted relationships (optional)")

    @field_validator("latitude", mode="before")
    @classmethod
    def validate_latitude(cls, v: float) -> float:
        from ..utils.validation import clamp_latitude
        return clamp_latitude(v)

    @field_validator("longitude", mode="before")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        from ..utils.validation import clamp_longitude
        return clamp_longitude(v)

    @field_validator("severity", mode="before")
    @classmethod
    def validate_severity(cls, v: int) -> int:
        from ..utils.validation import clamp_severity
        return clamp_severity(v)

    @field_validator("summary", "location_name")
    @classmethod
    def clean_text_fields(cls, v: str) -> str:
        from ..utils.text import clean_text
        return clean_text(v)
