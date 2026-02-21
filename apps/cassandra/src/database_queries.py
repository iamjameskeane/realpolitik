"""
Database queries for Cassandra service.
"""

import asyncpg
import json
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta


class DatabaseQueries:
    """Database query operations for Cassandra."""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
    
    async def get_pool(self) -> asyncpg.Pool:
        """Get database connection pool."""
        return await asyncpg.create_pool(
            self.database_url,
            min_size=5,
            max_size=20
        )
    
    async def fetch_events_by_ids(self, event_ids: List[str]) -> List[Dict[str, Any]]:
        """
        Fetch events from Atlas database by IDs.
        
        Args:
            event_ids: List of event IDs to fetch
            
        Returns:
            List of event dictionaries
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            query = """
                SELECT 
                    id, title, summary, category, coordinates, location_name,
                    region, severity, timestamp, last_updated, fallout_prediction,
                    sources, entities, relationships
                FROM events 
                WHERE id = ANY($1::text[])
                ORDER BY timestamp DESC
            """
            rows = await conn.fetch(query, event_ids)
            
            events = []
            for row in rows:
                event = dict(row)
                # Parse JSONB fields
                event["sources"] = json.loads(event["sources"]) if event["sources"] else []
                event["entities"] = json.loads(event["entities"]) if event["entities"] else []
                event["relationships"] = json.loads(event["relationships"]) if event["relationships"] else []
                events.append(event)
            
            return events
    
    async def update_event_fallout(
        self,
        event_id: str,
        fallout_prediction: str,
        analysis_metadata: Dict[str, Any]
    ) -> bool:
        """
        Update event fallout prediction in database.
        
        Args:
            event_id: Event ID to update
            fallout_prediction: New fallout prediction text
            analysis_metadata: Additional analysis metadata
            
        Returns:
            True if update successful
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            query = """
                UPDATE events 
                SET 
                    fallout_prediction = $1,
                    last_updated = $2,
                    analysis_metadata = $3
                WHERE id = $4
            """
            
            result = await conn.execute(
                query,
                fallout_prediction,
                datetime.utcnow().isoformat() + "Z",
                json.dumps(analysis_metadata),
                event_id
            )
            
            return "UPDATE 1" in result
    
    async def get_entity_events(
        self,
        entity_ids: List[str],
        days_back: int = 30
    ) -> List[Dict[str, Any]]:
        """
        Get recent events involving specific entities.
        
        Args:
            entity_ids: List of entity IDs
            days_back: How many days back to search
            
        Returns:
            List of related events
        """
        pool = await self.get_pool()
        async with pool.acquire() as conn:
            # First get event IDs from the entities table
            entity_events_query = """
                SELECT DISTINCT event_id 
                FROM event_entities 
                WHERE entity_id = ANY($1::uuid[])
            """
            
            event_ids = await conn.fetch(entity_events_query, entity_ids)
            event_id_list = [row['event_id'] for row in event_ids]
            
            if not event_id_list:
                return []
            
            # Then get the actual events
            cutoff_date = (datetime.utcnow() - timedelta(days=days_back)).isoformat() + "Z"
            
            events_query = """
                SELECT 
                    id, title, summary, category, coordinates, location_name,
                    severity, timestamp, fallout_prediction
                FROM events 
                WHERE id = ANY($1::uuid[])
                AND timestamp >= $2
                ORDER BY timestamp DESC
                LIMIT 100
            """
            
            rows = await conn.fetch(events_query, event_id_list, cutoff_date)
            return [dict(row) for row in rows]
    
    async def store_analysis_metadata(
        self,
        request_id: str,
        analysis_data: Dict[str, Any]
    ) -> bool:
        """
        Store analysis metadata for tracking and billing.
        
        Args:
            request_id: Analysis request ID
            analysis_data: Analysis metadata to store
            
        Returns:
            True if stored successfully
        """
        pool = await self.get_pool()
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
                datetime.utcnow().isoformat() + "Z",
                json.dumps(analysis_data.get('metadata', {}))
            )
            
            return "INSERT" in result or "UPDATE" in result