"""Analysis data models for AI-generated insights"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from enum import Enum
from decimal import Decimal

from pydantic import BaseModel, Field, validator


class AnalysisStatus(str, Enum):
    """Analysis processing states"""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CACHED = "CACHED"


class ImpactLevel(str, Enum):
    """Impact assessment levels"""
    MINIMAL = "MINIMAL"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class GeographicScope(str, Enum):
    """Geographic impact scope"""
    LOCAL = "LOCAL"
    REGIONAL = "REGIONAL"
    NATIONAL = "NATIONAL"
    INTERNATIONAL = "INTERNATIONAL"
    GLOBAL = "GLOBAL"


class AnalysisRequest(BaseModel):
    """Request for fallout analysis"""
    id: UUID = Field(default_factory=uuid4, description="Request identifier")
    user_id: str = Field(..., description="User who requested analysis")
    
    event_ids: List[UUID] = Field(..., min_items=1, description="Events to analyze")
    request_type: str = Field(default="fallout", description="Type of analysis")
    
    # Context
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    include_historical: bool = Field(default=True, description="Include historical analogues")
    
    # Preferences
    max_cost: Optional[Decimal] = Field(None, description="Maximum cost limit")
    timeout_seconds: int = Field(default=300, ge=60, le=1800, description="Analysis timeout")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Request timestamp")
    priority: str = Field(default="normal", description="Request priority")
    
    class Config:
        json_encoders = {
            UUID: str,
            Decimal: str,
        }


class ImpactAssessment(BaseModel):
    """Individual impact assessment"""
    target: str = Field(..., description="Assessment target")
    impact_level: ImpactLevel = Field(..., description="Impact severity")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Assessment confidence")
    
    description: str = Field(..., description="Impact description")
    timeline: str = Field(..., description="Expected timeline")
    
    # Metrics
    probability: float = Field(..., ge=0.0, le=1.0, description="Occurrence probability")
    magnitude: float = Field(..., ge=0.0, le=10.0, description="Impact magnitude")
    
    # Supporting evidence
    evidence: List[str] = Field(default_factory=list, description="Supporting evidence")
    sources: List[str] = Field(default_factory=list, description="Analysis sources")
    
    class Config:
        use_enum_values = True


class CascadingEffect(BaseModel):
    """Cascading effect from analysis"""
    id: str = Field(..., description="Effect identifier")
    description: str = Field(..., description="Effect description")
    
    trigger_conditions: List[str] = Field(default_factory=list, description="Trigger conditions")
    probability: float = Field(..., ge=0.0, le=1.0, description="Effect probability")
    
    impact_assessment: ImpactAssessment = Field(..., description="Impact of this effect")
    
    # Chain information
    chain_position: int = Field(..., description="Position in causal chain")
    dependencies: List[str] = Field(default_factory=list, description="Required precursors")
    
    # Timeline
    estimated_timeline: str = Field(..., description="Expected timeline")
    uncertainty_factors: List[str] = Field(default_factory=list, description="Uncertainty factors")
    
    class Config:
        use_enum_values = True


class FalloutAnalysis(BaseModel):
    """AI-generated impact assessment"""
    id: UUID = Field(default_factory=uuid4, description="Analysis identifier")
    request_id: UUID = Field(..., description="Associated request ID")
    
    # Analysis metadata
    status: AnalysisStatus = Field(..., description="Analysis status")
    model_used: str = Field(..., description="AI model used")
    cost_usd: Decimal = Field(..., ge=0.0, description="Analysis cost")
    
    # Content
    summary: str = Field(..., description="Analysis summary")
    key_insights: List[str] = Field(default_factory=list, description="Key insights")
    
    # Impact assessments
    direct_impacts: List[ImpactAssessment] = Field(
        default_factory=list,
        description="Direct impact assessments"
    )
    cascading_effects: List[CascadingEffect] = Field(
        default_factory=list,
        description="Cascading effect chain"
    )
    
    # Geographic scope
    geographic_scope: GeographicScope = Field(..., description="Geographic impact scope")
    affected_regions: List[str] = Field(default_factory=list, description="Affected regions")
    
    # Stakeholder analysis
    stakeholders: List[str] = Field(default_factory=list, description="Key stakeholders")
    stakeholder_impacts: Dict[str, ImpactLevel] = Field(
        default_factory=dict,
        description="Impact per stakeholder"
    )
    
    # Risk assessment
    overall_risk_level: ImpactLevel = Field(..., description="Overall risk level")
    risk_factors: List[str] = Field(default_factory=list, description="Risk factors")
    mitigation_opportunities: List[str] = Field(
        default_factory=list,
        description="Mitigation opportunities"
    )
    
    # Historical context
    historical_analogues: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Similar historical events"
    )
    
    # Confidence and uncertainty
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall confidence")
    uncertainty_factors: List[str] = Field(
        default_factory=list,
        description="Key uncertainty factors"
    )
    
    # Timing
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Analysis timestamp")
    completed_at: Optional[datetime] = Field(None, description="Completion timestamp")
    expires_at: Optional[datetime] = Field(None, description="Cache expiry")
    
    # Versioning
    version: int = Field(default=1, ge=1, description="Analysis version")
    invalidation_hash: Optional[str] = Field(None, description="Cache invalidation hash")
    
    # Status tracking
    processing_time_seconds: Optional[float] = Field(None, description="Processing duration")
    token_usage: Optional[Dict[str, int]] = Field(None, description="Token usage stats")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: str,
            Decimal: str,
        }


class AnalysisResult(BaseModel):
    """Analysis result for API responses"""
    analysis_id: UUID = Field(..., description="Analysis ID")
    request_id: UUID = Field(..., description="Request ID")
    status: AnalysisStatus = Field(..., description="Analysis status")
    
    # Summary information
    summary: Optional[str] = Field(None, description="Analysis summary")
    overall_risk_level: Optional[ImpactLevel] = Field(None, description="Risk level")
    geographic_scope: Optional[GeographicScope] = Field(None, description="Geographic scope")
    
    # Content (when completed)
    fallout_analysis: Optional[FalloutAnalysis] = Field(None, description="Full analysis")
    
    # Progress tracking
    progress: float = Field(default=0.0, ge=0.0, le=1.0, description="Progress 0-1")
    estimated_completion: Optional[datetime] = Field(None, description="ETA")
    
    # Error information
    error_message: Optional[str] = Field(None, description="Error if failed")
    retry_count: int = Field(default=0, ge=0, description="Retry attempts")
    
    # Metadata
    created_at: datetime = Field(..., description="Creation timestamp")
    last_updated: datetime = Field(default_factory=datetime.utcnow, description="Last update")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: str,
        }