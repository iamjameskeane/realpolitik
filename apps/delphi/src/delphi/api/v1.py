"""API v1 router with proper versioning"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import structlog

from .events import router as events_router
from .entities import router as entities_router  
from .analysis import router as analysis_router
from .websockets import chat_websocket, analysis_websocket
from ..core.auth import get_current_user

logger = structlog.get_logger()

# Create main v1 router
router = APIRouter(prefix="/api/v1", tags=["v1"])

# Include sub-routers
router.include_router(events_router, prefix="/events", tags=["events"])
router.include_router(entities_router, prefix="/entities", tags=["entities"])
router.include_router(analysis_router, prefix="/analysis", tags=["analysis"])

# Version info endpoint
@router.get("/version")
async def get_version_info():
    """Get API version information"""
    return {
        "version": "1.0.0",
        "api_version": "v1",
        "build_info": {
            "service": "delphi",
            "timestamp": datetime.utcnow().isoformat(),
            "environment": "development"
        },
        "features": [
            "events",
            "entities", 
            "analysis",
            "websockets",
            "health_checks"
        ]
    }

# Stats endpoint
@router.get("/stats")
async def get_api_stats(user=Depends(get_current_user)):
    """Get API usage statistics"""
    from delphi.api.websockets import get_connection_stats
    
    return {
        "service": "delphi",
        "version": "1.0.0",
        "uptime": "demo",
        "requests": {
            "total": 0,
            "today": 0,
            "by_endpoint": {}
        },
        "connections": get_connection_stats(),
        "user": user
    }

# Ping endpoint for monitoring
@router.get("/ping")
async def ping():
    """Simple ping endpoint for monitoring"""
    return {
        "pong": True,
        "timestamp": datetime.utcnow().isoformat(),
        "service": "delphi"
    }

# WebSocket endpoints (mounted separately in main app)
# These are included here for documentation purposes

# Example: Enhanced user profile endpoint
@router.get("/profile")
async def get_user_profile(user=Depends(get_current_user)):
    """Get current user profile"""
    return {
        "user_id": user.get("sub"),
        "email": user.get("email"),
        "role": user.get("role"),
        "permissions": user.get("permissions", []),
        "tier": user.get("tier", "free"),
        "profile_completed": True,
        "last_login": datetime.utcnow().isoformat()
    }

# Example: User preferences endpoint
@router.get("/preferences")
async def get_user_preferences(user=Depends(get_current_user)):
    """Get user preferences and settings"""
    return {
        "user_id": user.get("sub"),
        "preferences": {
            "notifications": {
                "email": True,
                "push": False,
                "analysis_updates": True
            },
            "display": {
                "theme": "dark",
                "timezone": "UTC",
                "language": "en"
            },
            "data": {
                "default_region": "global",
                "categories": ["MILITARY", "DIPLOMATIC"],
                "severity_threshold": "MEDIUM"
            }
        }
    }

# Example: System status endpoint
@router.get("/system/status")
async def get_system_status(user=Depends(get_current_user)):
    """Get comprehensive system status"""
    # This would query actual service health in production
    return {
        "status": "operational",
        "services": {
            "delphi": {"status": "healthy", "response_time_ms": 45},
            "database": {"status": "healthy", "response_time_ms": 12},
            "cache": {"status": "healthy", "response_time_ms": 3},
            "queue": {"status": "healthy", "response_time_ms": 8},
            "ai_service": {"status": "healthy", "response_time_ms": 150}
        },
        "performance": {
            "requests_per_second": 0,
            "average_response_time_ms": 35,
            "error_rate": 0.0,
            "uptime_percentage": 100.0
        },
        "timestamp": datetime.utcnow().isoformat()
    }

# API deprecation warnings
@router.get("/deprecation-info")
async def get_deprecation_info():
    """Information about upcoming API changes"""
    return {
        "current_version": "v1",
        "upcoming_changes": [
            {
                "version": "v2",
                "estimated_release": "2024-Q3",
                "breaking_changes": [
                    "Analysis API response format updated",
                    "Entity relationship model changed"
                ],
                "migration_guide": "https://docs.realpolitik.world/migration/v1-to-v2"
            }
        ],
        "recommended_actions": [
            "Subscribe to API change notifications",
            "Test integration with v2 beta when available",
            "Review migration guide for breaking changes"
        ]
    }