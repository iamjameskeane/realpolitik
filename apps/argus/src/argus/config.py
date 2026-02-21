"""
Configuration for Realpolitik Worker
=====================================
Centralized configuration management with environment variable loading.
"""

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config:
    """Worker configuration loaded from environment variables."""
    
    # API Keys
    openrouter_api_key: str
    push_api_secret: str
    
    # Database Connections (Realpolitik Ecosystem)
    database_url: str
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str
    qdrant_uri: str
    redis_url: str
    rabbitmq_url: str
    
    # Processing
    max_concurrent_requests: int
    model_enrichment: str
    model_synthesis: str
    
    # Storage (always database now, local is fallback)
    storage_mode: str  # "database" or "local"
    output_path: Path
    
    # Push Notifications
    push_api_url: str
    push_notification_threshold: int
    push_critical_threshold: int
    push_max_age_hours: int
    
    # Cache TTLs
    processed_article_ttl_hours: int
    geocode_cache_ttl_days: int
    
    # Incident Grouping
    grouping_distance_military: float
    grouping_distance_diplomacy: float
    grouping_distance_economy: float
    grouping_distance_unrest: float
    grouping_distance_default: float
    grouping_time_hours: int
    
    # Event Retention
    max_events: int
    severity_bonus_hours: dict[int, int]
    
    # Constellation Features
    enable_entities: bool
    enable_embeddings: bool
    enable_graph_storage: bool
    auto_merge_threshold: float
    review_threshold: float
    
    # AI Reasoning
    thinking_level: str  # "minimal", "low", "medium", "high"
    
    @classmethod
    def from_env(cls) -> "Config":
        """Load configuration from environment variables."""
        
        # Parse severity bonus hours from constants
        severity_bonus_hours = {
            10: 168,  # +1 week
            9: 120,   # +5 days
            8: 72,    # +3 days
            7: 48,    # +2 days
        }
        
        # Determine output path
        worker_dir = Path(__file__).parent
        output_path = worker_dir.parent / "public" / "events.json"
        
        return cls(
            # API Keys
            openrouter_api_key=os.getenv("OPENROUTER_API_KEY", ""),
            push_api_secret=os.getenv("PUSH_API_SECRET", ""),
            
            # Database Connections (Realpolitik Ecosystem)
            database_url=os.getenv("DATABASE_URL", ""),
            neo4j_uri=os.getenv("NEO4J_URI", ""),
            neo4j_username=os.getenv("NEO4J_USERNAME", ""),
            neo4j_password=os.getenv("NEO4J_PASSWORD", ""),
            qdrant_uri=os.getenv("QDRANT_URI", ""),
            redis_url=os.getenv("REDIS_URL", ""),
            rabbitmq_url=os.getenv("RABBITMQ_URL", ""),
            
            # Processing
            max_concurrent_requests=int(os.getenv("MAX_CONCURRENT_REQUESTS", "10")),
            model_enrichment=os.getenv("MODEL_ENRICHMENT", "anthropic/claude-3-haiku"),
            model_synthesis=os.getenv("MODEL_SYNTHESIS", "anthropic/claude-3-sonnet"),
            
            # Storage (default to database for production)
            storage_mode=os.getenv("STORAGE_MODE", "database"),
            output_path=output_path,
            
            # Push Notifications
            push_api_url=os.getenv("PUSH_API_URL", "https://realpolitik.world/api/push/send"),
            push_notification_threshold=int(os.getenv("PUSH_NOTIFICATION_THRESHOLD", "1")),
            push_critical_threshold=int(os.getenv("PUSH_CRITICAL_THRESHOLD", "9")),
            push_max_age_hours=int(os.getenv("PUSH_MAX_AGE_HOURS", "4")),
            
            # Cache TTLs
            processed_article_ttl_hours=int(os.getenv("PROCESSED_ARTICLE_TTL_HOURS", "48")),
            geocode_cache_ttl_days=int(os.getenv("GEOCODE_CACHE_TTL_DAYS", "30")),
            
            # Incident Grouping
            grouping_distance_military=float(os.getenv("GROUPING_DISTANCE_MILITARY", "0.1")),
            grouping_distance_diplomacy=float(os.getenv("GROUPING_DISTANCE_DIPLOMACY", "0.5")),
            grouping_distance_economy=float(os.getenv("GROUPING_DISTANCE_ECONOMY", "0.5")),
            grouping_distance_unrest=float(os.getenv("GROUPING_DISTANCE_UNREST", "0.3")),
            grouping_distance_default=float(os.getenv("GROUPING_DISTANCE_DEFAULT", "0.5")),
            grouping_time_hours=int(os.getenv("GROUPING_TIME_HOURS", "12")),
            
            # Event Retention
            max_events=int(os.getenv("MAX_EVENTS", "500")),
            severity_bonus_hours=severity_bonus_hours,
            
            # Constellation Features
            enable_entities=os.getenv("ENABLE_ENTITIES", "false").lower() == "true",
            enable_embeddings=os.getenv("ENABLE_EMBEDDINGS", "false").lower() == "true",
            enable_graph_storage=os.getenv("ENABLE_GRAPH_STORAGE", "false").lower() == "true",
            auto_merge_threshold=float(os.getenv("AUTO_MERGE_THRESHOLD", "0.92")),
            review_threshold=float(os.getenv("REVIEW_THRESHOLD", "0.85")),
            
            # AI Reasoning
            thinking_level=os.getenv("THINKING_LEVEL", "low"),  # minimal, low, medium, high
        )
    
    def validate(self, skip_database: bool = False) -> None:
        """Validate required configuration is present.

        Args:
            skip_database: Skip database connection validation (for testing)
        """
        errors = []
        
        # Check for OpenRouter API key (required)
        if not self.openrouter_api_key:
            errors.append("OPENROUTER_API_KEY is required")
        
        # Check database connections (required for production, optional for testing)
        if not skip_database:
            if not self.database_url:
                errors.append("DATABASE_URL is required for Atlas (PostgreSQL)")
            if not self.neo4j_uri:
                errors.append("NEO4J_URI is required for Ariadne (Neo4j)")
            if not self.neo4j_username:
                errors.append("NEO4J_USERNAME is required for Ariadne (Neo4j)")
            if not self.neo4j_password:
                errors.append("NEO4J_PASSWORD is required for Ariadne (Neo4j)")
            if not self.qdrant_uri:
                errors.append("QDRANT_URI is required for Mnemosyne (Qdrant)")
            if not self.redis_url:
                errors.append("REDIS_URL is required for Lethe (Redis)")
            if not self.rabbitmq_url:
                errors.append("RABBITMQ_URL is required for Iris (RabbitMQ)")
        
        # Check storage mode
        if self.storage_mode not in ("database", "local"):
            errors.append(f"STORAGE_MODE must be 'database' or 'local', got '{self.storage_mode}'")
        
        if errors:
            raise ValueError("Configuration errors:\n  " + "\n  ".join(errors))
    
    def get_grouping_distance(self, category: str) -> float:
        """Get the grouping distance for a category (in degrees)."""
        distances = {
            "MILITARY": self.grouping_distance_military,
            "DIPLOMACY": self.grouping_distance_diplomacy,
            "ECONOMY": self.grouping_distance_economy,
            "UNREST": self.grouping_distance_unrest,
        }
        return distances.get(category, self.grouping_distance_default)
    
    def get_ai_provider(self) -> str:
        """Get the AI provider (always OpenRouter)."""
        if not self.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is required")
        return "openrouter"
    
    def get_api_key(self) -> str:
        """Get the OpenRouter API key."""
        if not self.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is required")
        return self.openrouter_api_key
    
    def get_model_for_provider(self, model_type: str) -> str:
        """
        Get the appropriate model name for OpenRouter.
        
        Args:
            model_type: Either "enrichment" or "synthesis"
            
        Returns:
            Model name for OpenRouter
        """
        # OpenRouter model mappings
        model_mappings = {
            "enrichment": "anthropic/claude-3-haiku",
            "synthesis": "anthropic/claude-3-sonnet"
        }
        
        return model_mappings.get(model_type, model_mappings["enrichment"])
    
    def get_database_info(self) -> dict:
        """
        Get database connection info for logging (hides sensitive data).
        
        Returns:
            Dict with database connection status
        """
        return {
            "atlas": {
                "connected": bool(self.database_url),
                "url_configured": bool(self.database_url)
            },
            "ariadne": {
                "connected": bool(self.neo4j_uri and self.neo4j_username and self.neo4j_password),
                "uri_configured": bool(self.neo4j_uri),
                "auth_configured": bool(self.neo4j_username and self.neo4j_password)
            },
            "mnemosyne": {
                "connected": bool(self.qdrant_uri),
                "uri_configured": bool(self.qdrant_uri)
            },
            "lethe": {
                "connected": bool(self.redis_url),
                "uri_configured": bool(self.redis_url)
            },
            "iris": {
                "connected": bool(self.rabbitmq_url),
                "uri_configured": bool(self.rabbitmq_url)
            }
        }


# Geopolitical keywords for NewsAPI
GEOPOLITICAL_KEYWORDS = [
    "military", "troops", "war", "conflict", "missile", "nuclear", "defense",
    "sanctions", "tariff", "trade war", "embargo", "economy", "recession",
    "protest", "riot", "coup", "election", "diplomacy", "summit", "treaty",
    "alliance", "nato", "un", "security council", "invasion", "border",
]

# Source credibility tiers (higher = more credible)
SOURCE_CREDIBILITY: dict[str, int] = {
    # Tier 3: Wire Services & Major Broadcasters (most reliable)
    "associated press": 3, "ap": 3, "ap news": 3,
    "reuters": 3,
    "afp": 3, "agence france-presse": 3,
    "bbc": 3, "bbc news": 3, "bbc world": 3,
    "al jazeera": 3, "al jazeera english": 3,
    "npr": 3,
    "pbs": 3, "pbs newshour": 3,
    
    # Tier 2: Quality Papers & Established Outlets
    "the guardian": 2, "guardian": 2,
    "new york times": 2, "nyt": 2, "ny times": 2,
    "washington post": 2,
    "the economist": 2, "economist": 2,
    "financial times": 2, "ft": 2,
    "wall street journal": 2, "wsj": 2,
    "deutsche welle": 2, "dw": 2,
    "france24": 2, "france 24": 2,
    "abc news": 2,
    "cbs news": 2,
    "nbc news": 2,
    "cnn": 2,
    "politico": 2,
    "the hill": 2,
    "axios": 2,
    
    # Tier 1: Regional & Specialty Outlets
    "south china morning post": 1, "scmp": 1,
    "times of israel": 1,
    "the hindu": 1,
    "kyiv independent": 1,
    "jerusalem post": 1,
    "haaretz": 1,
    "japan times": 1,
    "straits times": 1,
    "the irish times": 1,
    "yahoo news": 1, "yahoo": 1,
    "business insider": 1,
    "new york magazine": 1,
    "the new yorker": 1,
    "the new republic": 1,
    "foreign policy": 1,
    "foreign affairs": 1,
    
    # Negative: Known unreliable/propaganda/clickbait (will be filtered)
    "sputnik": -1, "sputnikglobe": -1, "sputnik news": -1,
    "rt": -1, "russia today": -1,
    "global times": -1,
    "press tv": -1,
    "activistpost": -1,
    "zerohedge": -1,
    "infowars": -1,
    "natural news": -1,
    "the gateway pundit": -1,
    "breitbart": -1,
    "yahoo entertainment": -1,
    "dalenareporters": -1,
    "freerepublic": -1,
}


def get_source_credibility(source_name: str) -> int:
    """
    Get credibility score for a source.
    Returns: 3 (wire), 2 (quality), 1 (regional), 0 (unknown), -1 (unreliable)
    """
    if not source_name:
        return 0
    name_lower = source_name.lower().strip()
    # Check exact match first
    if name_lower in SOURCE_CREDIBILITY:
        return SOURCE_CREDIBILITY[name_lower]
    # Check partial matches
    for known_source, score in SOURCE_CREDIBILITY.items():
        if known_source in name_lower or name_lower in known_source:
            return score
    return 0  # Unknown source
