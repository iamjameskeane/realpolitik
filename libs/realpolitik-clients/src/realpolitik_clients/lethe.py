"""Lethe - Redis client for caching and session management"""

import redis.asyncio as redis
from typing import Optional, Dict, Any, Tuple
import json
import structlog

logger = structlog.get_logger()


class LetheClient:
    """Redis client for caching, sessions, and rate limiting"""
    
    def __init__(self, url: str = "redis://localhost:6379"):
        self.url = url
        self.redis_client = None
    
    async def connect(self):
        """Establish Redis connection"""
        try:
            self.redis_client = redis.from_url(self.url, decode_responses=True)
            await self.redis_client.ping()
            logger.info("Lethe connection established")
        except Exception as e:
            logger.error("Failed to connect to Lethe", error=str(e))
            raise
    
    async def disconnect(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Lethe connection closed")
    
    async def cache_analysis(
        self,
        cache_key: str,
        analysis_data: Dict[str, Any],
        ttl: int = 3600
    ):
        """Cache analysis result with TTL"""
        try:
            serialized_data = json.dumps(analysis_data, default=str)
            await self.redis_client.setex(cache_key, ttl, serialized_data)
            logger.info("Analysis cached", key=cache_key, ttl=ttl)
        except Exception as e:
            logger.error("Failed to cache analysis", error=str(e))
            raise
    
    async def get_cached_analysis(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get cached analysis result"""
        try:
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
            return None
        except Exception as e:
            logger.error("Failed to get cached analysis", error=str(e))
            return None
    
    async def store_session(
        self,
        session_id: str,
        session_data: Dict[str, Any],
        ttl: int = 3600
    ):
        """Store session data with TTL"""
        try:
            serialized_data = json.dumps(session_data, default=str)
            await self.redis_client.setex(f"session:{session_id}", ttl, serialized_data)
            logger.info("Session stored", session_id=session_id, ttl=ttl)
        except Exception as e:
            logger.error("Failed to store session", error=str(e))
            raise
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session data"""
        try:
            session_data = await self.redis_client.get(f"session:{session_id}")
            if session_data:
                return json.loads(session_data)
            return None
        except Exception as e:
            logger.error("Failed to get session", error=str(e))
            return None
    
    async def check_rate_limit(
        self,
        user_id: str,
        endpoint: str,
        limit: int = 100,
        window: int = 3600
    ) -> Tuple[bool, int]:
        """
        Check rate limit using sliding window algorithm
        Returns (allowed, remaining_requests)
        """
        try:
            key = f"rate_limit:{user_id}:{endpoint}"
            
            # Remove old entries outside window
            cutoff = await self.redis_client.time()
            cutoff = cutoff[0] - window
            
            await self.redis_client.zremrangebyscore(key, 0, cutoff)
            
            # Count current requests in window
            current_requests = await self.redis_client.zcard(key)
            
            if current_requests < limit:
                # Add current request
                current_time = await self.redis_client.time()
                current_time = current_time[0]
                
                await self.redis_client.zadd(key, {str(current_time): current_time})
                await self.redis_client.expire(key, window)
                
                remaining = limit - current_requests - 1
                logger.debug("Rate limit check passed", user_id=user_id, endpoint=endpoint, remaining=remaining)
                return True, remaining
            else:
                logger.debug("Rate limit exceeded", user_id=user_id, endpoint=endpoint, current=current_requests, limit=limit)
                return False, 0
                
        except Exception as e:
            logger.error("Rate limit check failed", error=str(e))
            return False, 0
    
    async def invalidate_cache_pattern(self, pattern: str):
        """Invalidate cache entries matching pattern"""
        try:
            keys = await self.redis_client.keys(pattern)
            if keys:
                await self.redis_client.delete(*keys)
                logger.info("Cache invalidated", pattern=pattern, count=len(keys))
        except Exception as e:
            logger.error("Failed to invalidate cache", error=str(e))
    
    async def test_connection(self) -> bool:
        """Test Redis connection"""
        try:
            await self.redis_client.ping()
            return True
        except Exception as e:
            logger.error("Connection test failed", error=str(e))
            return False
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()