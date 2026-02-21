"""
Storage operations for Cassandra microservice.
"""

import asyncio
import json
import hashlib
import time
from typing import Dict, List, Any, Optional
import redis.asyncio as redis
from models.requests import AnalysisRequest, AnalysisCacheKey


class StorageOperations:
    """Database and Redis operations for Cassandra."""
    
    def __init__(self, database_url: str, redis_url: str, cache_ttl_hours: int):
        self.database_url = database_url
        self.redis_url = redis_url
        self.cache_ttl_hours = cache_ttl_hours
        self._redis_client = None
    
    async def get_redis_client(self):
        """Get Redis client connection."""
        if self._redis_client is None:
            self._redis_client = redis.from_url(self.redis_url, encoding="utf-8", decode_responses=True)
        return self._redis_client
    
    async def check_analysis_cache(self, event_ids: List[str]) -> Optional[Dict[str, Any]]:
        """
        Check if analysis is already cached.
        
        Args:
            event_ids: List of event IDs
            
        Returns:
            Cached analysis or None
        """
        redis_client = await self.get_redis_client()
        
        # Create cache key based on event IDs
        cache_key = self._create_cache_key(event_ids)
        
        try:
            cached_data = await redis_client.get(f"analysis:{cache_key}")
            if cached_data:
                print(f"   💾 Cache hit for analysis {cache_key}")
                return json.loads(cached_data)
            else:
                print(f"   🔍 Cache miss for analysis {cache_key}")
                return None
                
        except Exception as e:
            print(f"   ⚠️ Cache check failed: {e}")
            return None
    
    async def cache_analysis_result(
        self,
        event_ids: List[str],
        fallout_predictions: Dict[str, str],
        analysis_metadata: Dict[str, Any]
    ) -> bool:
        """
        Cache analysis result in Redis.
        
        Args:
            event_ids: List of event IDs
            fallout_predictions: event_id -> fallout_prediction mapping
            analysis_metadata: Additional metadata to cache
            
        Returns:
            True if cached successfully
        """
        redis_client = await self.get_redis_client()
        
        cache_key = self._create_cache_key(event_ids)
        cache_data = {
            "fallout_predictions": fallout_predictions,
            "analysis_metadata": analysis_metadata,
            "cached_at": time.time()
        }
        
        try:
            # Cache with TTL
            ttl_seconds = self.cache_ttl_hours * 3600
            await redis_client.setex(
                f"analysis:{cache_key}",
                ttl_seconds,
                json.dumps(cache_data)
            )
            
            # Also cache individual event predictions for quick lookup
            for event_id, prediction in fallout_predictions.items():
                await redis_client.setex(
                    f"event_fallout:{event_id}",
                    ttl_seconds,
                    json.dumps({
                        "prediction": prediction,
                        "analysis_metadata": analysis_metadata,
                        "cached_at": time.time()
                    })
                )
            
            print(f"   💾 Cached analysis {cache_key}")
            return True
            
        except Exception as e:
            print(f"   ⚠️ Cache storage failed: {e}")
            return False
    
    async def invalidate_related_analyses(self, event_ids: List[str]) -> bool:
        """
        Invalidate analyses that might be affected by new events.
        
        Args:
            event_ids: Event IDs that were just processed
            
        Returns:
            True if invalidation successful
        """
        redis_client = await self.get_redis_client()
        
        try:
            invalidated_count = 0
            
            # Find analyses that reference these events
            for event_id in event_ids:
                # Scan for cached analyses that might reference this event
                pattern = "analysis:*"
                async for key in redis_client.scan_iter(pattern):
                    try:
                        cached_data = await redis_client.get(key)
                        if cached_data:
                            data = json.loads(cached_data)
                            # Check if this analysis references the event
                            cached_event_ids = self._extract_event_ids_from_cache_key(key)
                            if any(eid in cached_event_ids for eid in event_ids):
                                await redis_client.delete(key)
                                invalidated_count += 1
                    except (json.JSONDecodeError, KeyError):
                        continue
            
            # Invalidate individual event fallouts
            for event_id in event_ids:
                await redis_client.delete(f"event_fallout:{event_id}")
            
            print(f"   🗑️ Invalidated {invalidated_count} related analyses")
            return True
            
        except Exception as e:
            print(f"   ⚠️ Invalidation failed: {e}")
            return False
    
    async def get_event_fallout(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Get cached fallout prediction for a specific event.
        
        Args:
            event_id: Event ID to lookup
            
        Returns:
            Cached fallout or None
        """
        redis_client = await self.get_redis_client()
        
        try:
            cached_data = await redis_client.get(f"event_fallout:{event_id}")
            if cached_data:
                return json.loads(cached_data)
            return None
            
        except Exception as e:
            print(f"   ⚠️ Event fallout lookup failed: {e}")
            return None
    
    async def update_event_in_database(
        self,
        event_id: str,
        fallout_prediction: str,
        analysis_metadata: Dict[str, Any]
    ) -> bool:
        """
        Update event fallout prediction in PostgreSQL.
        
        Args:
            event_id: Event ID to update
            fallout_prediction: New fallout prediction
            analysis_metadata: Analysis metadata
            
        Returns:
            True if update successful
        """
        import asyncpg
        
        try:
            pool = await asyncpg.create_pool(self.database_url)
            async with pool.acquire() as conn:
                query = """
                    UPDATE events 
                    SET 
                        fallout_prediction = $1,
                        last_updated = $2,
                        analysis_metadata = COALESCE(analysis_metadata, '{}'::jsonb) || $3
                    WHERE id = $4
                """
                
                result = await conn.execute(
                    query,
                    fallout_prediction,
                    time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime()),
                    json.dumps(analysis_metadata),
                    event_id
                )
                
                return "UPDATE 1" in result
                
        except Exception as e:
            print(f"   ⚠️ Database update failed: {e}")
            return False
        finally:
            if 'pool' in locals():
                await pool.close()
    
    async def store_analysis_metadata(
        self,
        request_id: str,
        analysis_data: Dict[str, Any]
    ) -> bool:
        """
        Store analysis metadata for billing and monitoring.
        
        Args:
            request_id: Analysis request ID
            analysis_data: Analysis metadata to store
            
        Returns:
            True if stored successfully
        """
        import asyncpg
        
        try:
            pool = await asyncpg.create_pool(self.database_url)
            async with pool.acquire() as conn:
                query = """
                    INSERT INTO analysis_metadata (
                        request_id, event_ids, model_used, input_tokens, 
                        output_tokens, cost_usd, processing_time_seconds,
                        completed_at, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (request_id) DO UPDATE SET
                        input_tokens = EXCLUDED.input_tokens,
                        output_tokens = EXCLUDED.output_tokens,
                        cost_usd = EXCLUDED.cost_usd,
                        processing_time_seconds = EXCLUDED.processing_time_seconds,
                        completed_at = EXCLUDED.completed_at,
                        metadata = EXCLUDED.metadata
                """
                
                result = await conn.execute(
                    query,
                    request_id,
                    json.dumps(analysis_data.get('event_ids', [])),
                    analysis_data.get('model_used', ''),
                    analysis_data.get('input_tokens', 0),
                    analysis_data.get('output_tokens', 0),
                    analysis_data.get('cost_usd', 0.0),
                    analysis_data.get('processing_time_seconds', 0.0),
                    time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime()),
                    json.dumps(analysis_data.get('metadata', {}))
                )
                
                return "INSERT" in result or "UPDATE" in result
                
        except Exception as e:
            print(f"   ⚠️ Metadata storage failed: {e}")
            return False
        finally:
            if 'pool' in locals():
                await pool.close()
    
    async def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache usage statistics."""
        redis_client = await self.get_redis_client()
        
        try:
            # Count cached analyses
            analysis_keys = []
            event_keys = []
            
            async for key in redis_client.scan_iter("analysis:*"):
                analysis_keys.append(key)
            
            async for key in redis_client.scan_iter("event_fallout:*"):
                event_keys.append(key)
            
            # Get memory usage info
            info = await redis_client.info('memory')
            
            return {
                "cached_analyses": len(analysis_keys),
                "cached_events": len(event_keys),
                "memory_used_mb": round(info.get('used_memory', 0) / 1024 / 1024, 2),
                "cache_hit_rate": 0.0  # Would need to track this separately
            }
            
        except Exception as e:
            print(f"   ⚠️ Cache statistics failed: {e}")
            return {}
    
    def _create_cache_key(self, event_ids: List[str]) -> str:
        """Create deterministic cache key from event IDs."""
        # Sort to ensure consistency
        sorted_ids = sorted(event_ids)
        id_string = ",".join(sorted_ids)
        return hashlib.md5(id_string.encode()).hexdigest()
    
    def _extract_event_ids_from_cache_key(self, cache_key: str) -> List[str]:
        """Extract event IDs from cache key (reverse operation)."""
        # This is a simplified version - in practice you'd store the mapping
        # For now, return empty list as this is used for pattern matching
        return []


class AnalysisCache:
    """High-level analysis caching interface."""
    
    def __init__(self, storage: StorageOperations):
        self.storage = storage
    
    async def get_or_compute_analysis(
        self,
        event_ids: List[str],
        analysis_function
    ) -> Dict[str, Any]:
        """
        Get cached analysis or compute new one.
        
        Args:
            event_ids: Event IDs to analyze
            analysis_function: Async function to compute analysis if not cached
            
        Returns:
            Analysis result (cached or newly computed)
        """
        # Check cache first
        cached_result = await self.storage.check_analysis_cache(event_ids)
        if cached_result:
            return cached_result
        
        # Compute analysis
        print(f"   🧮 Computing new analysis for {len(event_ids)} events...")
        result = await analysis_function(event_ids)
        
        # Cache the result
        if result:
            await self.storage.cache_analysis_result(
                event_ids,
                result.get("fallout_predictions", {}),
                result.get("metadata", {})
            )
        
        return result