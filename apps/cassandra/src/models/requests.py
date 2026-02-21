"""
Request and response models for Cassandra analysis service.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from uuid import UUID


class AnalysisRequest(BaseModel):
    """Request schema for fallout analysis."""
    
    request_id: UUID = Field(..., description="Unique request identifier")
    event_ids: list[str] = Field(..., description="Event IDs to analyze")
    priority: Literal["normal", "high", "critical"] = Field(default="normal", description="Priority level")
    user_id: Optional[str] = Field(default=None, description="User ID (optional)")
    webhook_url: Optional[str] = Field(default=None, description="Webhook for completion notification")
    metadata: dict = Field(default_factory=dict, description="Additional metadata")
    
    class Config:
        json_encoders = {
            UUID: str
        }


class AnalysisResponse(BaseModel):
    """Response schema for analysis completion."""
    
    request_id: UUID
    status: Literal["completed", "failed", "cancelled"]
    event_ids: list[str]
    fallout_predictions: dict[str, str] = Field(default_factory=dict, description="event_id -> fallout_prediction")
    analysis_metadata: dict = Field(default_factory=dict, description="Cost, timing, etc.")
    error_message: Optional[str] = Field(default=None, description="Error details if failed")
    completed_at: str = Field(..., description="ISO 8601 timestamp")
    
    class Config:
        json_encoders = {
            UUID: str
        }


class AnalysisCacheKey(BaseModel):
    """Cache key generation for deduplication."""
    
    event_ids: list[str]
    request_hash: str = Field(..., description="Hash of normalized request")
    version: str = Field(default="v1", description="Cache version for invalidation")


class CostTracking(BaseModel):
    """Track analysis costs for billing."""
    
    request_id: UUID
    model_used: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    processing_time_seconds: float
    completed_at: str