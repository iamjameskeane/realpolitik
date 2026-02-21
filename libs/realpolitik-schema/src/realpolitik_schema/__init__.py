"""Realpolitik Schema Library - Canonical data models for the distributed intelligence platform"""

from .events import (
    GeopoliticalEvent,
    EventSource,
    EventSeverity,
    EventCategory,
    EventFilter,
)
from .analysis import (
    FalloutAnalysis,
    AnalysisRequest,
    AnalysisStatus,
    AnalysisResult,
)
from .entities import (
    Entity,
    EntityType,
    Relationship,
    EntityMention,
    EntityFilter,
)
from .messages import (
    EventIngested,
    AnalysisRequested,
    AnalysisCompleted,
    EventIngestFailed,
    MessageBase,
)

__version__ = "1.0.0"
__all__ = [
    # Events
    "GeopoliticalEvent",
    "EventSource",
    "EventSeverity",
    "EventCategory",
    "EventFilter",
    # Analysis
    "FalloutAnalysis",
    "AnalysisRequest",
    "AnalysisStatus",
    "AnalysisResult",
    # Entities
    "Entity",
    "EntityType",
    "Relationship",
    "EntityMention",
    "EntityFilter",
    # Messages
    "EventIngested",
    "AnalysisRequested",
    "AnalysisCompleted",
    "EventIngestFailed",
    "MessageBase",
]