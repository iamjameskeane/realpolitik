"""Query routing logic for different data stores"""

from typing import Dict, Any, Optional, List, Union
from datetime import datetime
import structlog

from ..deps.database import get_atlas_client
from ..deps.cache import get_lethe_client
from realpolitik_schema import EventFilter

logger = structlog.get_logger()

class QueryRouter:
    """Routes queries to appropriate data stores based on query patterns"""
    
    def __init__(self):
        self.routing_rules = {
            "temporal": self._route_temporal_query,
            "relationship": self._route_relationship_query,
            "semantic": self._route_semantic_query,
            "text_search": self._route_text_search,
            "cached": self._route_cached_query
        }
    
    async def route_event_query(
        self,
        query_params: Dict[str, Any],
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Route event queries to the most appropriate data store
        
        Query routing logic:
        - Temporal filters → PostgreSQL (Atlas)
        - Text search → PostgreSQL + Redis cache
        - Similarity search → Qdrant (Mnemosyne)  
        - Relationship traversal → Neo4j (Ariadne)
        """
        
        route_decision = self._analyze_query_pattern(query_params)
        logger.info("Query routed", route=route_decision["store"], pattern=route_decision["pattern"])
        
        # Route to appropriate handler
        handler = self.routing_rules.get(route_decision["pattern"])
        if not handler:
            # Default to Atlas (PostgreSQL)
            return await self._route_temporal_query(query_params, user_context)
        
        return await handler(query_params, user_context)
    
    def _analyze_query_pattern(self, query_params: Dict[str, Any]) -> Dict[str, str]:
        """Analyze query parameters to determine optimal routing"""
        
        # Check for semantic similarity search
        if query_params.get("similar_to") or query_params.get("embeddings"):
            return {"store": "mnemosyne", "pattern": "semantic"}
        
        # Check for relationship traversal  
        if query_params.get("relationships") or query_params.get("entity_id"):
            return {"store": "ariadne", "pattern": "relationship"}
        
        # Check for text search
        if query_params.get("search") and len(query_params["search"]) > 10:
            return {"store": "atlas_cache", "pattern": "text_search"}
        
        # Check for temporal filtering
        if (query_params.get("start_date") or query_params.get("end_date") or 
            query_params.get("time_range")):
            return {"store": "atlas", "pattern": "temporal"}
        
        # Default temporal query
        return {"store": "atlas", "pattern": "temporal"}
    
    async def _route_temporal_query(
        self,
        query_params: Dict[str, Any],
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Route to PostgreSQL for temporal queries"""
        
        atlas = get_atlas_client()
        lethe = get_lethe_client()
        
        # Build cache key for temporal queries
        cache_key = f"temporal:{hash(str(sorted(query_params.items())))}"
        
        # Check cache first for simple queries
        if not query_params.get("search") and not query_params.get("embeddings"):
            cached_result = await lethe.get_cached_analysis(cache_key)
            if cached_result:
                return {
                    "data": cached_result,
                    "source": "cache",
                    "store": "redis"
                }
        
        # Query PostgreSQL
        events = await atlas.get_events(**query_params)
        
        # Cache results
        await lethe.cache_analysis(cache_key, events, ttl=300)  # 5 minutes
        
        return {
            "data": events,
            "source": "database", 
            "store": "atlas"
        }
    
    async def _route_relationship_query(
        self,
        query_params: Dict[str, Any],
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Route to Neo4j for relationship queries"""
        
        # This would integrate with Ariadne client for Neo4j
        # For now, return placeholder
        
        return {
            "data": [],
            "source": "graph",
            "store": "ariadne",
            "note": "Neo4j integration pending"
        }
    
    async def _route_semantic_query(
        self,
        query_params: Dict[str, Any],
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Route to Qdrant for semantic similarity"""
        
        # This would integrate with Mnemosyne client for Qdrant
        # For now, return placeholder
        
        return {
            "data": [],
            "source": "vector",
            "store": "mnemosyne", 
            "note": "Qdrant integration pending"
        }
    
    async def _route_text_search(
        self,
        query_params: Dict[str, Any],
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Route text search with caching"""
        
        atlas = get_atlas_client()
        lethe = get_lethe_client()
        
        # Check cache first for text searches
        cache_key = f"search:{hash(query_params.get('search', ''))}"
        cached_result = await lethe.get_cached_analysis(cache_key)
        
        if cached_result:
            return {
                "data": cached_result,
                "source": "cache",
                "store": "redis"
            }
        
        # Query PostgreSQL with text search
        events = await atlas.get_events(**query_params)
        
        # Cache search results longer (10 minutes for text search)
        await lethe.cache_analysis(cache_key, events, ttl=600)
        
        return {
            "data": events,
            "source": "database",
            "store": "atlas"
        }
    
    async def _route_cached_query(
        self,
        query_params: Dict[str, Any],
        user_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Route to Redis cache"""
        
        lethe = get_lethe_client()
        
        cache_key = query_params.get("cache_key")
        if not cache_key:
            return {
                "data": [],
                "source": "cache_miss",
                "store": "redis"
            }
        
        cached_data = await lethe.get_cached_analysis(cache_key)
        
        return {
            "data": cached_data or [],
            "source": "cache",
            "store": "redis"
        }

# Global query router instance
query_router = QueryRouter()

# Convenience functions for common query patterns
async def query_temporal_events(filters: EventFilter) -> Dict[str, Any]:
    """Query events by temporal filters"""
    query_params = filters.model_dump(exclude_none=True)
    return await query_router.route_event_query(query_params)

async def query_similar_events(event_id: str, limit: int = 5) -> Dict[str, Any]:
    """Query semantically similar events"""
    query_params = {
        "similar_to": event_id,
        "limit": limit
    }
    return await query_router.route_event_query(query_params)

async def query_related_events(entity_id: str, max_depth: int = 2) -> Dict[str, Any]:
    """Query events related to an entity"""
    query_params = {
        "entity_id": entity_id,
        "relationships": True,
        "max_depth": max_depth
    }
    return await query_router.route_event_query(query_params)

async def query_text_search(search_term: str, limit: int = 20) -> Dict[str, Any]:
    """Query events by text search"""
    query_params = {
        "search": search_term,
        "limit": limit
    }
    return await query_router.route_event_query(query_params)