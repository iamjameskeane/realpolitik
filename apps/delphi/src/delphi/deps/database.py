"""Database dependency management"""

import asyncio
from typing import Optional
import structlog

from realpolitik_clients import AtlasClient
from ..core.config import settings

logger = structlog.get_logger()

# Global database clients
atlas_client: Optional[AtlasClient] = None

async def init_database():
    """Initialize database connections"""
    global atlas_client
    
    try:
        atlas_client = AtlasClient(settings.database_url)
        await atlas_client.connect()
        logger.info("Atlas database initialized")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise

async def close_database():
    """Close database connections"""
    global atlas_client
    
    if atlas_client:
        await atlas_client.disconnect()
        logger.info("Atlas database connection closed")

def get_atlas_client() -> AtlasClient:
    """Get Atlas client instance"""
    if not atlas_client:
        raise RuntimeError("Atlas client not initialized")
    return atlas_client