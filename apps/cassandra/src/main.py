"""
Main entry point for Cassandra microservice.
"""

import asyncio
import signal
import sys
import time
from typing import Optional

from config import Config
from analysis_engine import CassandraAnalysisEngine
from consumer import AnalysisConsumer, QueueMonitor
from ai_client import QuotaExhaustedError


class CassandraService:
    """Main service orchestrator."""
    
    def __init__(self):
        self.config: Optional[Config] = None
        self.analysis_engine: Optional[CassandraAnalysisEngine] = None
        self.consumer: Optional[AnalysisConsumer] = None
        self.monitor: Optional[QueueMonitor] = None
        self.shutdown_event = asyncio.Event()
        
    async def initialize(self):
        """Initialize service components."""
        print("🚀 Initializing Cassandra microservice...")
        
        # Load configuration
        self.config = Config.from_env()
        self.config.validate()
        
        print("✅ Configuration loaded")
        print(f"   Models: {self.config.model_enrichment} / {self.config.model_synthesis}")
        print(f"   Concurrency: {self.config.max_concurrent_requests}")
        print(f"   Cache TTL: {self.config.analysis_cache_ttl_hours}h")
        print(f"   Queue: {self.config.rabbitmq_queue}")
        
        # Initialize analysis engine
        self.analysis_engine = CassandraAnalysisEngine(self.config)
        
        # Pre-flight AI check
        try:
            await self.analysis_engine.ai_client.check_quota()
            provider_info = self.analysis_engine.ai_client.get_model_info()
            print(f"✅ AI service ready: {provider_info['provider']}")
            print(f"   Enrichment: {provider_info['enrichment_model']}")
            print(f"   Synthesis: {provider_info['synthesis_model']}")
        except QuotaExhaustedError as e:
            print(f"❌ AI service unavailable: {e}")
            sys.exit(1)
        
        # Initialize consumer
        self.consumer = AnalysisConsumer(self.config, self.analysis_engine)
        self.monitor = QueueMonitor(self.config, self.consumer)
        
        print("✅ Cassandra service initialized")
    
    async def start(self):
        """Start the service."""
        print("🎯 Starting Cassandra microservice...")
        
        # Set up signal handlers for graceful shutdown
        for sig in [signal.SIGTERM, signal.SIGINT]:
            signal.signal(sig, lambda s, f: asyncio.create_task(self.shutdown()))
        
        try:
            # Start queue monitor
            await self.monitor.start_monitoring()
            
            # Start consuming messages
            await self.consumer.start_consuming()
            
        except Exception as e:
            print(f"❌ Service error: {e}")
            await self.shutdown()
    
    async def shutdown(self):
        """Graceful shutdown."""
        print("🛑 Initiating graceful shutdown...")
        
        # Signal shutdown
        self.shutdown_event.set()
        
        # Stop consumer
        if self.consumer:
            await self.consumer.stop()
        
        # Stop monitor
        if self.monitor:
            await self.monitor.stop_monitoring()
        
        # Shutdown analysis engine
        if self.analysis_engine:
            await self.analysis_engine.shutdown()
        
        print("✅ Cassandra service shutdown complete")
        sys.exit(0)
    
    async def run(self):
        """Main service loop."""
        await self.initialize()
        
        try:
            await self.start()
        except KeyboardInterrupt:
            await self.shutdown()
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            await self.shutdown()


async def main():
    """Main entry point."""
    service = CassandraService()
    await service.run()


if __name__ == "__main__":
    asyncio.run(main())