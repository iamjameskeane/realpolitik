"""Application configuration and settings"""

from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from pydantic_settings import BaseSettings
import structlog


class Settings(BaseSettings):
    """Application settings"""

    # Application
    version: str = "1.0.0"
    environment: str = "development"
    app_name: str = "Delphi API Server"

    # API Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # CORS
    allowed_origins: List[str] = ["http://localhost:3000", "http://localhost:8080"]

    # Database URLs
    database_url: str
    neo4j_uri: str
    qdrant_uri: str
    redis_url: str
    rabbitmq_url: str

    # Authentication
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"

    # OpenRouter (for AI services)
    openrouter_api_key: str
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 100
    rate_limit_window: int = 3600  # seconds

    # Logging
    log_level: str = "INFO"
    structured_logging: bool = True

    # Health checks
    health_check_timeout: int = 30

    # Cache
    cache_default_ttl: int = 3600

    # Message queue
    message_timeout: int = 300

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="",
        case_sensitive=False,
        extra="ignore"
    )


# Global settings instance
settings = Settings()

# Setup logging
def setup_logging():
    """Configure structured logging"""
    if settings.structured_logging:
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                structlog.processors.TimeStamper(fmt="ISO"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.processors.JSONRenderer()
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )
    else:
        structlog.configure(
            processors=[
                structlog.stdlib.filter_by_level,
                structlog.stdlib.add_logger_name,
                structlog.stdlib.add_log_level,
                structlog.stdlib.PositionalArgumentsFormatter(),
                structlog.processors.TimeStamper(fmt="ISO"),
                structlog.processors.StackInfoRenderer(),
                structlog.processors.format_exc_info,
                structlog.processors.UnicodeDecoder(),
                structlog.dev.ConsoleRenderer(colors=True)
            ],
            context_class=dict,
            logger_factory=structlog.stdlib.LoggerFactory(),
            wrapper_class=structlog.stdlib.BoundLogger,
            cache_logger_on_first_use=True,
        )

# Initialize logger
logger = structlog.get_logger()