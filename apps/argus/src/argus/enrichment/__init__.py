"""
AI enrichment modules for article processing.
"""

from .openrouter_client import OpenRouterClient, OpenRouterQuotaExhaustedError, OpenRouterAuthenticationError
from .ai_client import AIClient, QuotaExhaustedError, AuthenticationError
from .article import enrich_article
from .geocoding import geocode_enriched_articles, lookup_location_in_dict
from .synthesis import synthesize_incident, get_credibility_label
from .entities import (
    extract_entities_and_relationships,
    validate_entities,
    validate_relationships,
)

__all__ = [
    # OpenRouter AI clients
    "AIClient",
    "OpenRouterClient",
    "QuotaExhaustedError",
    "AuthenticationError",
    "OpenRouterQuotaExhaustedError",
    "OpenRouterAuthenticationError",
    
    # Enrichment functions
    "enrich_article",
    "geocode_enriched_articles",
    "lookup_location_in_dict",
    "synthesize_incident",
    "get_credibility_label",
    "extract_entities_and_relationships",
    "validate_entities",
    "validate_relationships",
]
