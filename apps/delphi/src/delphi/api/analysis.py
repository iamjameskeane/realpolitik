"""Analysis API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import structlog
from uuid import UUID

from realpolitik_schema import AnalysisRequest, AnalysisResult
from ..deps.database import get_atlas_client
from ..deps.cache import get_lethe_client
from ..deps.rabbitmq import get_iris_client
from ..core.auth import get_current_user

logger = structlog.get_logger()
router = APIRouter()

@router.post("/request", response_model=AnalysisRequest)
async def request_analysis(
    event_ids: List[UUID] = Query(..., description="Event IDs to analyze"),
    include_historical: bool = Query(True, description="Include historical analogues"),
    max_cost: Optional[float] = Query(None, description="Maximum cost limit"),
    user=Depends(get_current_user)
):
    """Request fallout analysis for specified events"""
    try:
        atlas = get_atlas_client()
        lethe = get_lethe_client()
        iris = get_iris_client()
        
        # Create analysis request
        request_id = str(UUID())
        analysis_request = AnalysisRequest(
            id=UUID(request_id),
            user_id=user['sub'],
            event_ids=event_ids,
            include_historical=include_historical,
            max_cost=max_cost
        )
        
        # Check if analysis already exists in cache
        event_hash = hash(tuple(sorted(event_ids)))
        cache_key = f"analysis:{event_hash}:v1"
        
        cached_analysis = await lethe.get_cached_analysis(cache_key)
        if cached_analysis and not cached_analysis.get('stale', False):
            logger.info("Returning cached analysis", request_id=request_id)
            return analysis_request
        
        # Publish analysis request to message queue
        request_data = {
            "request_id": request_id,
            "user_id": user['sub'],
            "event_ids": [str(eid) for eid in event_ids],
            "include_historical": include_historical,
            "max_cost": max_cost,
            "source": "delphi"
        }
        
        await iris.publish_analysis_request(request_data)
        
        logger.info("Analysis requested", request_id=request_id, event_count=len(event_ids), user_id=user['sub'])
        return analysis_request
        
    except Exception as e:
        logger.error("Failed to request analysis", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to request analysis")

@router.get("/{request_id}", response_model=AnalysisResult)
async def get_analysis_result(
    request_id: str,
    user=Depends(get_current_user)
):
    """Get analysis result by request ID"""
    try:
        atlas = get_atlas_client()
        lethe = get_lethe_client()
        
        # Check cache first
        cache_key = f"analysis:{request_id}"
        cached_result = await lethe.get_cached_analysis(cache_key)
        
        if cached_result:
            logger.info("Analysis served from cache", request_id=request_id)
            return AnalysisResult(**cached_result)
        
        # Try to get from database
        # This would require proper database queries for analysis results
        # For now, return processing status
        result = AnalysisResult(
            analysis_id=UUID(),
            request_id=UUID(request_id),
            status="PROCESSING",
            progress=0.0,
            created_at=datetime.utcnow()
        )
        
        # Cache the result for a short time
        await lethe.cache_analysis(cache_key, result.model_dump(), ttl=60)
        
        logger.info("Analysis result retrieved", request_id=request_id, user_id=user['sub'])
        return result
        
    except Exception as e:
        logger.error("Failed to get analysis result", request_id=request_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get analysis result")

@router.get("/{request_id}/status")
async def get_analysis_status(
    request_id: str,
    user=Depends(get_current_user)
):
    """Get analysis status and progress"""
    try:
        lethe = get_lethe_client()
        
        # Check cache for status updates
        status_key = f"analysis_status:{request_id}"
        status_data = await lethe.get_cached_analysis(status_key)
        
        if not status_data:
            return {
                "request_id": request_id,
                "status": "PENDING",
                "progress": 0.0,
                "message": "Analysis not started"
            }
        
        logger.info("Analysis status retrieved", request_id=request_id, status=status_data.get('status'))
        return {
            "request_id": request_id,
            "status": status_data.get('status'),
            "progress": status_data.get('progress', 0.0),
            "message": status_data.get('message'),
            "estimated_completion": status_data.get('estimated_completion')
        }
        
    except Exception as e:
        logger.error("Failed to get analysis status", request_id=request_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get analysis status")

@router.delete("/{request_id}")
async def cancel_analysis(
    request_id: str,
    user=Depends(get_current_user)
):
    """Cancel a pending analysis request"""
    try:
        lethe = get_lethe_client()
        
        # Remove from cache and mark as cancelled
        status_key = f"analysis_status:{request_id}"
        status_data = await lethe.get_cached_analysis(status_key)
        
        if status_data and status_data.get('status') in ['PENDING', 'PROCESSING']:
            # Update status to cancelled
            status_data['status'] = 'CANCELLED'
            status_data['cancelled_at'] = datetime.utcnow()
            status_data['cancelled_by'] = user['sub']
            
            # This would also need to publish cancellation message to RabbitMQ
            logger.info("Analysis cancelled", request_id=request_id, user_id=user['sub'])
            
            return {"message": "Analysis cancelled successfully"}
        else:
            raise HTTPException(status_code=400, detail="Analysis cannot be cancelled")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to cancel analysis", request_id=request_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to cancel analysis")

@router.get("/history/user")
async def get_user_analysis_history(
    limit: int = Query(20, ge=1, le=100, description="Number of results"),
    offset: int = Query(0, ge=0, description="Number to skip"),
    user=Depends(get_current_user)
):
    """Get user's analysis history"""
    try:
        atlas = get_atlas_client()
        
        # This would require querying the database for user's analysis requests
        # For now, return placeholder data
        history = []
        
        logger.info("User analysis history retrieved", user_id=user['sub'], count=len(history))
        return {
            "requests": history,
            "total": len(history),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error("Failed to get analysis history", user_id=user['sub'], error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get analysis history")

@router.get("/statistics/usage")
async def get_analysis_statistics(
    user=Depends(get_current_user)
):
    """Get analysis usage statistics"""
    try:
        # This would require aggregating analysis data
        # For now, return placeholder data
        stats = {
            "total_requests": 0,
            "successful_analyses": 0,
            "failed_analyses": 0,
            "total_cost_usd": 0.0,
            "average_processing_time": 0.0,
            "requests_by_category": {},
            "most_analyzed_event_types": []
        }
        
        logger.info("Analysis statistics retrieved", user_id=user['sub'])
        return stats
        
    except Exception as e:
        logger.error("Failed to get analysis statistics", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to get statistics")