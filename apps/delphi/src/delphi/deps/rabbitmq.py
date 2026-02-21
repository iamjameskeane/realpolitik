"""RabbitMQ dependency management"""

import asyncio
from typing import Optional
import structlog

from realpolitik_clients import IrisClient
from ..core.config import settings

logger = structlog.get_logger()

# Global RabbitMQ clients
iris_client: Optional[IrisClient] = None

async def init_rabbitmq():
    """Initialize RabbitMQ connections"""
    global iris_client
    
    try:
        iris_client = IrisClient(settings.rabbitmq_url)
        await iris_client.connect()
        logger.info("Iris message queue initialized")
    except Exception as e:
        logger.error("Failed to initialize RabbitMQ", error=str(e))
        raise

async def close_rabbitmq():
    """Close RabbitMQ connections"""
    global iris_client
    
    if iris_client:
        await iris_client.disconnect()
        logger.info("Iris message queue connection closed")

def get_iris_client() -> IrisClient:
    """Get Iris client instance"""
    if not iris_client:
        raise RuntimeError("Iris client not initialized")
    return iris_client