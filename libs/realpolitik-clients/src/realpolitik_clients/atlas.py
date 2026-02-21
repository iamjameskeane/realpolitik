"""Atlas - PostgreSQL client for Realpolitik"""

import asyncpg
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
from typing import List, Optional, Dict, Any
import structlog

logger = structlog.get_logger()


class AtlasClient:
    """PostgreSQL client for transactional data and event sourcing"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = None
        self.session_maker = None
        self._pool = None
    
    async def connect(self):
        """Establish database connection"""
        try:
            self.engine = create_async_engine(
                self.database_url,
                echo=False,
                pool_size=5,
                max_overflow=10,
                pool_recycle=3600,
            )
            self.session_maker = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            # Test connection
            async with self.engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info("Atlas connection established")
        except Exception as e:
            logger.error("Failed to connect to Atlas", error=str(e))
            raise
    
    async def disconnect(self):
        """Close database connection"""
        if self.engine:
            await self.engine.dispose()
            logger.info("Atlas connection closed")
    
    async def get_events(self, limit: int = 50, **filters) -> List[Dict[str, Any]]:
        """Get events with optional filters"""
        async with self.session_maker() as session:
            try:
                query = """
                    SELECT id, title, summary, category, severity, occurred_at,
                           primary_location, coordinates, content, entities,
                           confidence_score, tags, status
                    FROM geopolitical_events
                    WHERE 1=1
                """
                params = {}
                
                # Apply filters
                if filters.get('category'):
                    query += " AND category = :category"
                    params['category'] = filters['category']
                
                if filters.get('severity'):
                    query += " AND severity = :severity"
                    params['severity'] = filters['severity']
                
                if filters.get('location'):
                    query += " AND primary_location ILIKE :location"
                    params['location'] = f"%{filters['location']}%"
                
                if filters.get('start_date'):
                    query += " AND occurred_at >= :start_date"
                    params['start_date'] = filters['start_date']
                
                if filters.get('end_date'):
                    query += " AND occurred_at <= :end_date"
                    params['end_date'] = filters['end_date']
                
                query += " ORDER BY occurred_at DESC LIMIT :limit"
                params['limit'] = limit
                
                result = await session.execute(text(query), params)
                return [dict(row._mapping) for row in result.fetchall()]
                
            except Exception as e:
                logger.error("Failed to fetch events", error=str(e))
                return []
    
    async def write_event(self, event_data: Dict[str, Any]) -> Optional[str]:
        """Write event using outbox pattern"""
        async with self.session_maker() as session:
            try:
                async with session.begin():
                    # Insert event
                    event_query = """
                        INSERT INTO geopolitical_events (
                            title, summary, category, severity, occurred_at,
                            primary_location, coordinates, content, entities,
                            confidence_score, tags, sources, status
                        ) VALUES (
                            :title, :summary, :category, :severity, :occurred_at,
                            :primary_location, :coordinates, :content, :entities,
                            :confidence_score, :tags, :sources, :status
                        ) RETURNING id
                    """
                    
                    result = await session.execute(text(event_query), event_data)
                    event_id = str(result.scalar())
                    
                    # Create outbox entry
                    outbox_query = """
                        INSERT INTO outbox (payload, destination_topic, processed_at)
                        VALUES (:payload, :destination_topic, NOW())
                    """
                    
                    outbox_payload = {
                        "event_id": event_id,
                        "event_data": event_data,
                        "message_type": "event.ingested"
                    }
                    
                    await session.execute(
                        text(outbox_query),
                        {
                            "payload": outbox_payload,
                            "destination_topic": "event.ingested"
                        }
                    )
                    
                    logger.info("Event written to Atlas", event_id=event_id)
                    return event_id
                    
            except Exception as e:
                logger.error("Failed to write event", error=str(e))
                raise
    
    async def store_analysis(self, request_id: str, analysis_data: Dict[str, Any]):
        """Store fallout analysis result"""
        async with self.session_maker() as session:
            try:
                async with session.begin():
                    query = """
                        INSERT INTO fallout_analyses (
                            request_id, analysis_id, status, summary,
                            cost_usd, model_used, geographic_scope,
                            overall_risk_level, confidence_score
                        ) VALUES (
                            :request_id, :analysis_id, :status, :summary,
                            :cost_usd, :model_used, :geographic_scope,
                            :overall_risk_level, :confidence_score
                        )
                        ON CONFLICT (request_id) DO UPDATE SET
                            status = EXCLUDED.status,
                            summary = EXCLUDED.summary,
                            analysis_data = EXCLUDED.analysis_data,
                            updated_at = NOW()
                    """
                    
                    await session.execute(text(query), analysis_data)
                    logger.info("Analysis stored", request_id=request_id)
                    
            except Exception as e:
                logger.error("Failed to store analysis", error=str(e))
                raise
    
    async def test_connection(self) -> bool:
        """Test database connection"""
        try:
            async with self.engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error("Connection test failed", error=str(e))
            return False
    
    async def __aenter__(self):
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()