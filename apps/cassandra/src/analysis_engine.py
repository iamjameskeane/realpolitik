"""
Main analysis engine orchestrating Cassandra microservice.
"""

import asyncio
import time
import uuid
from typing import Dict, Any, Optional
from models.requests import AnalysisRequest, AnalysisResponse
from models.events import EventSource
from .ai_client import AIClient
from .graph_queries import GraphQueries
from .database_queries import DatabaseQueries
from .context_assembly import ContextAssembler
from .synthesis import EnhancedSynthesizer, synthesize_incident_legacy
from .storage import StorageOperations, AnalysisCache


class CassandraAnalysisEngine:
    """Main analysis engine for Cassandra microservice."""
    
    def __init__(self, config):
        self.config = config
        
        # Initialize components
        self.ai_client = AIClient(
            api_key=config.openrouter_api_key,
            model_enrichment=config.model_enrichment,
            model_synthesis=config.model_synthesis
        )
        
        self.graph_queries = GraphQueries(
            neo4j_uri=config.neo4j_uri,
            neo4j_username=config.neo4j_username,
            neo4j_password=config.neo4j_password,
            qdrant_uri=config.qdrant_uri,
            database_url=config.database_url
        )
        
        self.db_queries = DatabaseQueries(database_url=config.database_url)
        
        self.storage = StorageOperations(
            database_url=config.database_url,
            redis_url=config.redis_url,
            cache_ttl_hours=config.analysis_cache_ttl_hours
        )
        
        self.context_assembler = ContextAssembler(
            graph_queries=self.graph_queries,
            db_queries=self.db_queries
        )
        
        self.synthesizer = EnhancedSynthesizer(
            ai_client=self.ai_client,
            graph_queries=self.graph_queries
        )
        
        self.cache = AnalysisCache(self.storage)
        
        # Statistics
        self.stats = {
            "requests_processed": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "total_processing_time": 0.0
        }
    
    async def process_analysis_request(
        self, 
        request: AnalysisRequest
    ) -> Optional[AnalysisResponse]:
        """
        Process a complete analysis request.
        
        Args:
            request: Analysis request with event IDs
            
        Returns:
            Analysis response with fallout predictions
        """
        start_time = time.time()
        request_id = request.request_id
        
        try:
            print(f"🔄 Processing analysis request {request_id}")
            
            # Step 1: Check cache first
            cached_result = await self.storage.check_analysis_cache(request.event_ids)
            if cached_result:
                self.stats["cache_hits"] += 1
                return self._create_success_response(
                    request, 
                    cached_result["fallout_predictions"],
                    cached_result["analysis_metadata"],
                    time.time() - start_time,
                    cached=True
                )
            
            self.stats["cache_misses"] += 1
            
            # Step 2: Assemble comprehensive context
            context = await self.context_assembler.build_analysis_context(
                request.event_ids,
                include_historical_analogues=True,
                include_causal_chains=True
            )
            
            # Step 3: Process events with enhanced synthesis
            fallout_predictions = {}
            analysis_metadata = {
                "context_assembly_time_ms": context.graph_query_time_ms,
                "context_size_tokens": context.context_size_tokens,
                "model_used": self.config.model_synthesis,
                "processing_started": time.time()
            }
            
            for event in context.primary_events:
                try:
                    # Convert event sources for synthesis
                    event_sources = self._convert_event_to_sources(event)
                    
                    # Enhanced synthesis with graph context
                    synthesized = await self.synthesizer.synthesize_with_context(
                        event_sources,
                        context,
                        self.config.model_synthesis
                    )
                    
                    if synthesized:
                        fallout_predictions[event["id"]] = synthesized.fallout_prediction
                        
                        # Update event in database
                        await self.storage.update_event_in_database(
                            event["id"],
                            synthesized.fallout_prediction,
                            analysis_metadata
                        )
                        
                        print(f"  ✅ Updated fallout for event {event['id']}")
                    else:
                        print(f"  ⚠️ Synthesis failed for event {event['id']}")
                        
                except Exception as e:
                    print(f"  ❌ Failed to process event {event['id']}: {e}")
            
            # Step 4: Cache the result
            processing_time = time.time() - start_time
            analysis_metadata.update({
                "processing_time_seconds": processing_time,
                "events_processed": len(fallout_predictions),
                "cache_key": self.storage._create_cache_key(request.event_ids)
            })
            
            await self.storage.cache_analysis_result(
                request.event_ids,
                fallout_predictions,
                analysis_metadata
            )
            
            # Step 5: Store analysis metadata for billing
            await self.storage.store_analysis_metadata(
                str(request_id),
                {
                    "event_ids": request.event_ids,
                    "model_used": self.config.model_synthesis,
                    "processing_time_seconds": processing_time,
                    "fallout_predictions_count": len(fallout_predictions),
                    "context_assembly_time_ms": context.graph_query_time_ms
                }
            )
            
            # Update statistics
            self.stats["requests_processed"] += 1
            self.stats["total_processing_time"] += processing_time
            
            return self._create_success_response(
                request,
                fallout_predictions,
                analysis_metadata,
                processing_time,
                cached=False
            )
            
        except Exception as e:
            print(f"❌ Analysis request {request_id} failed: {e}")
            return self._create_error_response(request, str(e))
    
    def _convert_event_to_sources(self, event: Dict[str, Any]) -> list[EventSource]:
        """Convert database event to EventSource objects."""
        sources = []
        
        for source_data in event.get("sources", []):
            source = EventSource(
                id=source_data.get("id", ""),
                headline=source_data.get("headline", ""),
                summary=source_data.get("summary", ""),
                source_name=source_data.get("source_name", ""),
                source_url=source_data.get("source_url", ""),
                timestamp=source_data.get("timestamp", "")
            )
            sources.append(source)
        
        return sources
    
    def _create_success_response(
        self,
        request: AnalysisRequest,
        fallout_predictions: Dict[str, str],
        analysis_metadata: Dict[str, Any],
        processing_time: float,
        cached: bool = False
    ) -> AnalysisResponse:
        """Create successful analysis response."""
        
        return AnalysisResponse(
            request_id=request.request_id,
            status="completed",
            event_ids=request.event_ids,
            fallout_predictions=fallout_predictions,
            analysis_metadata={
                **analysis_metadata,
                "cached": cached,
                "processing_time_seconds": processing_time,
                "average_time_per_event": processing_time / len(request.event_ids) if request.event_ids else 0
            },
            completed_at=time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())
        )
    
    def _create_error_response(
        self,
        request: AnalysisRequest,
        error_message: str
    ) -> AnalysisResponse:
        """Create error analysis response."""
        
        return AnalysisResponse(
            request_id=request.request_id,
            status="failed",
            event_ids=request.event_ids,
            error_message=error_message,
            completed_at=time.strftime('%Y-%m-%d %H:%M:%S', time.gmtime())
        )
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get processing statistics."""
        
        cache_stats = await self.storage.get_cache_statistics()
        
        return {
            **self.stats,
            "cache_statistics": cache_stats,
            "average_processing_time": (
                self.stats["total_processing_time"] / max(self.stats["requests_processed"], 1)
            ),
            "cache_hit_rate": (
                self.stats["cache_hits"] / max(
                    self.stats["cache_hits"] + self.stats["cache_misses"], 1
                )
            )
        }
    
    async def shutdown(self):
        """Shutdown the analysis engine."""
        print("🛑 Shutting down Cassandra analysis engine...")
        
        # Close any open connections
        if hasattr(self.graph_queries, '_neo4j_driver') and self.graph_queries._neo4j_driver:
            await self.graph_queries._neo4j_driver.close()
        
        if hasattr(self.storage, '_redis_client') and self.storage._redis_client:
            await self.storage._redis_client.close()
        
        print("✅ Cassandra analysis engine shutdown complete")