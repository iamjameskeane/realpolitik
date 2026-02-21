"""
Caching layer for the Realpolitik worker.
"""

from .articles import (
    is_article_processed,
    mark_article_processed,
    get_processed_articles_batch,
    mark_articles_processed_batch,
)
from .geocodes import (
    get_cached_geocode,
    cache_geocode,
    get_cached_geocodes_batch,
    cache_geocodes_batch,
    invalidate_geocode_cache,
    invalidate_all_geocode_cache,
)

__all__ = [
    "is_article_processed",
    "mark_article_processed",
    "get_processed_articles_batch",
    "mark_articles_processed_batch",
    "get_cached_geocode",
    "cache_geocode",
    "get_cached_geocodes_batch",
    "cache_geocodes_batch",
    "invalidate_geocode_cache",
    "invalidate_all_geocode_cache",
]
