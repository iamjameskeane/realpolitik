"""Cache dependency management"""

import asyncio
from typing import Optional
import structlog

from realpolitik_clients import LetheClient
from ..core.config import settings

logger = structlog.get_logger()

# Global cache clients
lethe_client: Optional[LetheClient] = None

async def init_cache():
    """Initialize cache connections"""
    global lethe_client
    
    try:
        lethe_client = LetheClient(settings.redis_url)
        await lethe_client.connect()
        logger.info("Lethe cache initialized")
    except Exception as e:
        logger.error("Failed to initialize cache", error=str(e))
        raise

async def close_cache():
    """Close cache connections"""
    global lethe_client
    
    if lethe_client:
        await lethe_client.disconnect()
        logger.info("Lethe cache connection closed")

def get_lethe_client() -> LetheClient:
    """Get Lethe client instance"""
    if not lethe_client:
        raise RuntimeError("Lethe client not initialized")
    return lethe_client