"""
Realpolitik Data Sources
========================

This module contains data source integrations for fetching news articles.
Primary: RSS feeds (real-time, unlimited)
Backup: NewsAPI (gap-filling, rate-limited)
"""

from .rss_feeds import (
    fetch_rss_articles,
    dedupe_articles,
    titles_similar,
    RSS_FEEDS,
)

__all__ = [
    "fetch_rss_articles",
    "dedupe_articles",
    "titles_similar",
    "RSS_FEEDS",
]
