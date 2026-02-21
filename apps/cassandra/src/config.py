"""
Configuration management for Cassandra microservice.
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class Config:
    """Cassandra service configuration."""
    
    # Database Connections (Realpolitik Ecosystem)
    database_url: str
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str
    qdrant_uri: str
    redis_url: str
    rabbitmq_url: str
    
    # AI Service
    openrouter_api_key: str
    
    # Processing
    max_concurrent_requests: int
    analysis_timeout_seconds: int
    model_enrichment: str
    model_synthesis: str
    
    # Caching
    analysis_cache_ttl_hours: int
    max_cache_size_mb: int
    
    # Queue Settings
    rabbitmq_queue: str
    rabbitmq_routing_key: str
    prefetch_count: int
    retry_attempts: int
    retry_delay_seconds: int
    
    # Monitoring
    enable_metrics: bool
    metrics_port: int
    
    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        return cls(
            # Database Connections
            database_url=os.getenv("DATABASE_URL", ""),
            neo4j_uri=os.getenv("NEO4J_URI", ""),
            neo4j_username=os.getenv("NEO4J_USERNAME", ""),
            neo4j_password=os.getenv("NEO4J_PASSWORD", ""),
            qdrant_uri=os.getenv("QDRANT_URI", ""),
            redis_url=os.getenv("REDIS_URL", ""),
            rabbitmq_url=os.getenv("RABBITMQ_URL", ""),
            
            # AI Service
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
            
            # Processing
            max_concurrent_requests=int(os.getenv("CASSANDRA_MAX_CONCURRENT", "5")),
            analysis_timeout_seconds=int(os.getenv("ANALYSIS_TIMEOUT_SECONDS", "120")),
            model_enrichment=os.getenv("MODEL_ENRICHMENT", "anthropic/claude-3-haiku"),
            model_synthesis=os.getenv("MODEL_SYNTHESIS", "anthropic/claude-3-sonnet"),
            
            # Caching
            analysis_cache_ttl_hours=int(os.getenv("ANALYSIS_CACHE_TTL_HOURS", "24")),
            max_cache_size_mb=int(os.getenv("MAX_CACHE_SIZE_MB", "500")),
            
            # Queue Settings
            rabbitmq_queue=os.getenv("RABBITMQ_QUEUE", "analysis.requested"),
            rabbitmq_routing_key=os.getenv("RABBITMQ_ROUTING_KEY", "analysis.requested"),
            prefetch_count=int(os.getenv("RABBITMQ_PREFETCH_COUNT", "10")),
            retry_attempts=int(os.getenv("RETRY_ATTEMPTS", "3")),
            retry_delay_seconds=int(os.getenv("RETRY_DELAY_SECONDS", "30")),
            
            # Monitoring
            enable_metrics=os.getenv("ENABLE_METRICS", "true").lower() == "true",
            metrics_port=int(os.getenv("METRICS_PORT", "8080")),
        )
    
    def validate(self) -> None:
        """Validate required configuration is present."""
        errors = []
        
        # Required database connections
        if not self.database_url:
            errors.append("DATABASE_URL is required for Atlas (PostgreSQL)")
        if not self.neo4j_uri:
            errors.append("NEO4J_URI is required for Ariadne (Neo4j)")
        if not self.neo4j_username:
            errors.append("NEO4J_USERNAME is required for Ariadne")
        if not self.neo4j_password:
            errors.append("NEO4J_PASSWORD is required for Ariadne")
        if not self.qdrant_uri:
            errors.append("QDRANT_URI is required for Mnemosyne (Qdrant)")
        if not self.redis_url:
            errors.append("REDIS_URL is required for Lethe (Redis)")
        if not self.rabbitmq_url:
            errors.append("RABBITMQ_URL is required for Iris (RabbitMQ)")
        
        # AI Service
        if not self.openrouter_api_key:
            errors.append("OPENROUTER_API_KEY is required")
        
        if errors:
            raise ValueError("Configuration errors:\n  " + "\n  ".join(errors))