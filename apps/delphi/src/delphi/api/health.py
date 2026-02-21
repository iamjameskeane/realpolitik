"""Health check endpoints"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import structlog

from ..deps.database import get_atlas_client
from ..deps.cache import get_lethe_client
from ..deps.rabbitmq import get_iris_client

logger = structlog.get_logger()
router = APIRouter()

@router.get("/")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "delphi",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/detailed")
async def detailed_health_check():
    """Detailed health check with database connectivity"""
    health_status = {
        "status": "healthy",
        "service": "delphi",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {}
    }
    
    try:
        # Check Atlas (PostgreSQL)
        atlas = get_atlas_client()
        atlas_healthy = await atlas.test_connection()
        health_status["dependencies"]["atlas"] = "healthy" if atlas_healthy else "unhealthy"
        
        # Check Lethe (Redis)
        lethe = get_lethe_client()
        lethe_healthy = await lethe.test_connection()
        health_status["dependencies"]["lethe"] = "healthy" if lethe_healthy else "unhealthy"
        
        # Check Iris (RabbitMQ)
        iris = get_iris_client()
        iris_healthy = await iris.test_connection()
        health_status["dependencies"]["iris"] = "healthy" if iris_healthy else "unhealthy"
        
        # Overall health
        all_healthy = atlas_healthy and lethe_healthy and iris_healthy
        health_status["status"] = "healthy" if all_healthy else "degraded"
        
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        health_status["status"] = "unhealthy"
        health_status["error"] = str(e)
    
    return health_status

@router.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes"""
    try:
        # Check if all critical services are available
        atlas = get_atlas_client()
        lethe = get_lethe_client()
        
        atlas_ready = await atlas.test_connection()
        lethe_ready = await lethe.test_connection()
        
        if atlas_ready and lethe_ready:
            return {"status": "ready"}
        else:
            raise HTTPException(status_code=503, detail="Service not ready")
            
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(status_code=503, detail="Service not ready")

@router.get("/live")
async def liveness_check():
    """Liveness check for Kubernetes"""
    return {"status": "alive"}