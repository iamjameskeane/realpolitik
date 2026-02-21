"""
Location and geocoding models.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Literal


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
        from ..utils.validation import clamp_latitude
        return clamp_latitude(v)

    @field_validator("longitude", mode="before")
    @classmethod
    def validate_longitude(cls, v: float) -> float:
        from ..utils.validation import clamp_longitude
        return clamp_longitude(v)
