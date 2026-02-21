"""Events API endpoints"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import datetime
import structlog

from realpolitik_schema import GeopoliticalEvent, EventFilter
from ..deps.database import get_atlas_client
from ..deps.cache import get_lethe_client
from ..core.auth import get_current_user

logger = structlog.get_logger()
router = APIRouter()

@router.get("/", response_model=List[GeopoliticalEvent])
async def list_events(
    limit: int = Query(50, ge=1, le=100, description="Number of events to return"),
    offset: int = Query(0, ge=0, description="Number of events to skip"),
    category: Optional[str] = Query(None, description="Filter by event category"),
    severity: Optional[str] = Query(None, description="Filter by event severity"),
    location: Optional[str] = Query(None, description="Filter by location"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    search: Optional[str] = Query(None, description="Search query"),
    user=Depends(get_current_user)
):
    """Get events with optional filters and pagination"""
    try:
        atlas = get_atlas_client()
        lethe = get_lethe_client()
        
        # Build filters
        filters = {
            "limit": limit,
            "offset": offset
        }
        
        if category:
            filters["category"] = category
        if severity:
            filters["severity"] = severity
        if location:
            filters["location"] = location
        if start_date:
            filters["start_date"] = start_date
        if end_date:
            filters["end_date"] = end_date
        if search:
            filters["search"] = search
        
        # Try to get from cache first (for search queries)
        cache_key = f"events:{hash(str(filters))}"
        if search or category or severity:
            cached_events = await lethe.get_cached_analysis(cache_key)
            if cached_events:
                logger.info("Events served from cache", cache_key=cache_key)
                return cached_events
        
        # Get from database
        events_data = await atlas.get_events(**filters)
        
        # Convert to Pydantic models
        events = []
        for event_data in events_data:
            try:
                # Handle JSON fields
                if isinstance(event_data.get('coordinates'), str):
                    event_data['coordinates'] = eval(event_data['coordinates'])
                if isinstance(event_data.get('entities'), str):
                    event_data['entities'] = eval(event_data['entities'])
                if isinstance(event_data.get('tags'), str):
                    event_data['tags'] = eval(event_data['tags'])
                if isinstance(event_data.get('sources'), str):
                    event_data['sources'] = eval(event_data['sources'])
                
                event = GeopoliticalEvent(**event_data)
                events.append(event)
            except Exception as e:
                logger.warning("Failed to parse event data", event_id=event_data.get('id'), error=str(e))
                continue
        
        # Cache search results
        if search or category or severity:
            await lethe.cache_analysis(cache_key, events, ttl=300)  # 5 minutes cache
        
        logger.info("Events retrieved", count=len(events), user_id=user.get('sub'))
        return events
        
    except Exception as e:
        logger.error("Failed to retrieve events", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve events")

@router.get("/{event_id}", response_model=GeopoliticalEvent)
async def get_event(
    event_id: str,
    user=Depends(get_current_user)
):
    """Get a specific event by ID"""
    try:
        atlas = get_atlas_client()
        
        # Get from database
        events = await atlas.get_events(limit=1)
        event = next((e for e in events if str(e.get('id')) == event_id), None)
        
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Convert to Pydantic model
        try:
            # Handle JSON fields
            if isinstance(event.get('coordinates'), str):
                event['coordinates'] = eval(event['coordinates'])
            if isinstance(event.get('entities'), str):
                event['entities'] = eval(event['entities'])
            if isinstance(event.get('tags'), str):
                event['tags'] = eval(event['tags'])
            if isinstance(event.get('sources'), str):
                event['sources'] = eval(event['sources'])
            
            return GeopoliticalEvent(**event)
            
        except Exception as e:
            logger.error("Failed to parse event data", event_id=event_id, error=str(e))
            raise HTTPException(status_code=500, detail="Invalid event data")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to retrieve event", event_id=event_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve event")

@router.get("/{event_id}/similar")
async def get_similar_events(
    event_id: str,
    limit: int = Query(5, ge=1, le=20, description="Number of similar events to return"),
    user=Depends(get_current_user)
):
    """Get events similar to the specified event using vector search"""
    try:
        # This would require Qdrant integration for semantic similarity
        # For now, return a placeholder response
        return {
            "event_id": event_id,
            "similar_events": [],
            "search_method": "vector_similarity",
            "note": "Feature requires Qdrant integration"
        }
        
    except Exception as e:
        logger.error("Failed to find similar events", event_id=event_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to find similar events")

@router.get("/statistics/overview")
async def get_events_statistics(
    user=Depends(get_current_user)
):
    """Get events statistics and overview"""
    try:
        atlas = get_atlas_client()
        
        # This would be more complex SQL aggregations
        # For now, return placeholder data
        stats = {
            "total_events": 0,
            "events_by_category": {},
            "events_by_severity": {},
            "events_by_location": {},
            "recent_activity": {
                "last_24h": 0,
                "last_week": 0,
                "last_month": 0
            }
        }
        
        logger.info("Events statistics retrieved", user_id=user.get('sub'))
        return stats
        
    except Exception as e:
        logger.error("Failed to retrieve events statistics", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve statistics")