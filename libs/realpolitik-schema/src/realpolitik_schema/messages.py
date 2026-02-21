"""Message models for inter-service communication"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from uuid import UUID, uuid4
from enum import Enum

from pydantic import BaseModel, Field


class MessageType(str, Enum):
    """Message types for inter-service communication"""
    EVENT_INGESTED = "event.ingested"
    ANALYSIS_REQUESTED = "analysis.requested"
    ANALYSIS_COMPLETED = "analysis.completed"
    ANALYSIS_FAILED = "analysis.failed"
    EVENT_INGEST_FAILED = "event.ingest.failed"
    ANALYSIS_INVALIDATED = "analysis.invalidated"
    CACHE_INVALIDATED = "cache.invalidated"


class MessageBase(BaseModel):
    """Base message structure"""
    message_id: UUID = Field(default_factory=uuid4, description="Unique message ID")
    message_type: MessageType = Field(..., description="Message type")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")
    
    # Routing
    source_service: str = Field(..., description="Originating service")
    correlation_id: Optional[UUID] = Field(None, description="Correlation ID")
    
    # Metadata
    version: str = Field(default="1.0", description="Message version")
    retry_count: int = Field(default=0, ge=0, description="Retry attempts")
    max_retries: int = Field(default=3, ge=0, le=10, description="Max retries")
    
    # Status
    status: str = Field(default="pending", description="Message status")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: str,
        }


class EventIngested(BaseModel):
    """Event ingested notification for CDC"""
    message_id: UUID = Field(default_factory=uuid4, description="Message identifier")
    message_type: MessageType = MessageType.EVENT_INGESTED
    
    # Event information
    event_id: UUID = Field(..., description="Ingested event ID")
    event_data: Dict[str, Any] = Field(..., description="Event data")
    
    # Ingestion metadata
    source_service: str = Field(default="argus", description="Source service")
    ingestion_timestamp: datetime = Field(default_factory=datetime.utcnow, description="Ingestion time")
    
    # CDC metadata
    wal_position: Optional[str] = Field(None, description="WAL position")
    table_name: str = Field(default="geopolitical_events", description="Source table")
    
    # Properties
    correlation_id: Optional[UUID] = Field(None, description="Correlation ID")
    version: str = Field(default="1.0", description="Message version")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: str,
        }


class AnalysisRequested(BaseModel):
    """Analysis request message"""
    message_id: UUID = Field(default_factory=uuid4, description="Message identifier")
    message_type: MessageType = MessageType.ANALYSIS_REQUESTED
    
    # Request information
    request_id: UUID = Field(..., description="Analysis request ID")
    user_id: str = Field(..., description="Requesting user")
    
    # Analysis parameters
    event_ids: List[UUID] = Field(..., min_items=1, description="Events to analyze")
    request_type: str = Field(default="fallout", description="Analysis type")
    
    # Context
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    include_historical: bool = Field(default=True, description="Include historical analogues")
    
    # Constraints
    max_cost: Optional[float] = Field(None, description="Cost limit")
    timeout_seconds: int = Field(default=300, description="Analysis timeout")
    
    # Metadata
    source_service: str = Field(..., description="Requesting service")
    priority: str = Field(default="normal", description="Request priority")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Request time")
    
    # Properties
    correlation_id: Optional[UUID] = Field(None, description="Correlation ID")
    version: str = Field(default="1.0", description="Message version")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: str,
        }


class AnalysisCompleted(BaseModel):
    """Analysis completion notification"""
    message_id: UUID = Field(default_factory=uuid4, description="Message identifier")
    message_type: MessageType = MessageType.ANALYSIS_COMPLETED
    
    # Analysis information
    request_id: UUID = Field(..., description="Associated request ID")
    analysis_id: UUID = Field(..., description="Analysis ID")
    
    # Results
    success: bool = Field(..., description="Analysis success status")
    summary: Optional[str] = Field(None, description="Analysis summary")
    
    # Error information
    error_message: Optional[str] = Field(None, description="Error if failed")
    error_code: Optional[str] = Field(None, description="Error code")
    
    # Performance metrics
    processing_time_seconds: Optional[float] = Field(None, description="Processing duration")
    cost_usd: Optional[float] = Field(None, description="Analysis cost")
    token_usage: Optional[Dict[str, int]] = Field(None, description="Token usage")
    
    # Metadata
    source_service: str = Field(default="cassandra", description="Processing service")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Completion time")
    
    # Properties
    correlation_id: Optional[UUID] = Field(None, description="Correlation ID")
    version: str = Field(default="1.0", description="Message version")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: str,
        }


class EventIngestFailed(BaseModel):
    """Event ingestion failure notification"""
    message_id: UUID = Field(default_factory=uuid4, description="Message identifier")
    message_type: MessageType = MessageType.EVENT_INGEST_FAILED
    
    # Event information
    event_data: Optional[Dict[str, Any]] = Field(None, description="Failed event data")
    
    # Error details
    error_message: str = Field(..., description="Error description")
    error_code: str = Field(..., description="Error code")
    error_details: Optional[Dict[str, Any]] = Field(None, description="Additional error details")
    
    # Source information
    source_service: str = Field(default="argus", description="Source service")
    source_url: Optional[str] = Field(None, description="Source URL")
    
    # Retry information
    retry_count: int = Field(default=0, ge=0, description="Retry attempts")
    can_retry: bool = Field(default=True, description="Can retry ingestion")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Failure time")
    
    # Properties
    correlation_id: Optional[UUID] = Field(None, description="Correlation ID")
    version: str = Field(default="1.0", description="Message version")
    
    class Config:
        use_enum_values = True
        json_encoders = {
            UUID: str,
        }