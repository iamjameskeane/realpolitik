"""
RSS Feed Ingestion Layer
========================

Fetches articles from curated RSS feeds for real-time geopolitical news.
This replaces NewsAPI as the primary data source for speed.

Feed Selection Criteria:
- Speed: Wire services update within minutes of breaking news
- Quality: Established outlets with editorial standards
- Coverage: Mix of global and regional specialists
- Reliability: Stable RSS feeds that don't change frequently

Usage:
    articles = fetch_rss_articles(max_age_hours=6)
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import feedparser

# ---------------------------------------------------------------------------
# RSS Feed Configuration
# ---------------------------------------------------------------------------

RSS_FEEDS: dict[str, str] = {
    # Tier 1: Major Broadcasters (most reliable)
    "bbc_world": "https://feeds.bbci.co.uk/news/world/rss.xml",
    "aljazeera": "https://www.aljazeera.com/xml/rss/all.xml",
    "dw": "https://rss.dw.com/xml/rss-en-world",
    "france24": "https://www.france24.com/en/rss",
    "npr": "https://feeds.npr.org/1004/rss.xml",  # NPR World News
    "cnn_world": "http://rss.cnn.com/rss/edition_world.rss",
    "nbc_world": "https://feeds.nbcnews.com/nbcnews/public/world",
    "sky_news": "https://feeds.skynews.com/feeds/rss/world.xml",
    
    # Tier 2: Quality Papers
    "guardian": "https://www.theguardian.com/world/rss",
    "nyt_world": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    "wapo_world": "https://feeds.washingtonpost.com/rss/world",
    "google_news": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFZxYUdjU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en",
    
    # Tier 3: Regional Specialists
    "scmp": "https://www.scmp.com/rss/91/feed",  # South China Morning Post (Asia)
    "times_of_israel": "https://www.timesofisrael.com/feed/",  # Middle East
    "hindu": "https://www.thehindu.com/news/international/feeder/default.rss",  # South Asia
    "japan_times": "https://www.japantimes.co.jp/feed/topstories/",  # Japan/East Asia
    "moscow_times": "https://www.themoscowtimes.com/rss/news",  # Russia coverage
    "euronews": "https://www.euronews.com/rss?level=theme&name=news-world",  # Europe focus
    "cna_asia": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml",  # SE Asia
    
    # Tier 4: Conflict/Security Focus
    "abc_intl": "https://abcnews.go.com/abcnews/internationalheadlines",
    "cbs_world": "https://www.cbsnews.com/latest/rss/world",
    "breaking_defense": "https://breakingdefense.com/feed/",  # Defense/military news
    
    # Tier 5: Policy/Analysis (longer-form)
    "foreign_affairs": "https://www.foreignaffairs.com/rss.xml",  # Policy analysis
}

# Friendly names for logging
FEED_NAMES: dict[str, str] = {
    "bbc_world": "BBC World",
    "aljazeera": "Al Jazeera",
    "dw": "Deutsche Welle",
    "france24": "France24",
    "npr": "NPR World",
    "cnn_world": "CNN World",
    "nbc_world": "NBC News World",
    "sky_news": "Sky News",
    "guardian": "The Guardian",
    "nyt_world": "NY Times World",
    "wapo_world": "Washington Post",
    "google_news": "Google News",
    "scmp": "South China Morning Post",
    "times_of_israel": "Times of Israel",
    "hindu": "The Hindu",
    "japan_times": "Japan Times",
    "moscow_times": "Moscow Times",
    "euronews": "Euronews",
    "cna_asia": "CNA Asia",
    "abc_intl": "ABC News",
    "cbs_world": "CBS World",
    "breaking_defense": "Breaking Defense",
    "foreign_affairs": "Foreign Affairs",
}


@dataclass
class RSSArticle:
    """Standardized article from any RSS feed."""
    title: str
    description: str
    url: str
    source_name: str
    published: datetime
    feed_id: str


def _parse_timestamp(entry: feedparser.FeedParserDict) -> Optional[datetime]:
    """Extract and parse timestamp from a feed entry."""
    # Try published_parsed first
    if hasattr(entry, 'published_parsed') and entry.published_parsed:
        try:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        except (TypeError, ValueError):
            pass
    
    # Try updated_parsed as fallback
    if hasattr(entry, 'updated_parsed') and entry.updated_parsed:
        try:
            return datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
        except (TypeError, ValueError):
            pass
    
    # Default to now
    return datetime.now(timezone.utc)


def _normalize_url(url: str) -> str:
    """Remove tracking parameters from URL for deduplication."""
    # Simple normalization: strip common tracking params
    if '?' in url:
        base = url.split('?')[0]
        return base
    return url


# Common words to exclude from title fingerprinting
_STOP_WORDS = frozenset([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "been",
    "be", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "says", "said", "say", "tells", "told", "report", "reports", "reported",
    "news", "breaking", "update", "latest", "new", "after", "before",
])

# Normalize common variations (country names, etc.)
_WORD_NORMALIZE = {
    "ukraine": "ukraine", "ukrainian": "ukraine", "ukrainians": "ukraine", "kyiv": "ukraine",
    "russia": "russia", "russian": "russia", "russians": "russia", "moscow": "russia", "putin": "russia",
    "israel": "israel", "israeli": "israel", "israelis": "israel", "idf": "israel",
    "gaza": "palestine", "palestinian": "palestine", "palestinians": "palestine", "hamas": "palestine",
    "china": "china", "chinese": "china", "beijing": "china",
    "iran": "iran", "iranian": "iran", "tehran": "iran",
    "syria": "syria", "syrian": "syria", "damascus": "syria",
    "attack": "attack", "attacks": "attack", "attacked": "attack",
    "strike": "strike", "strikes": "strike", "struck": "strike",
    "kill": "kill", "kills": "kill", "killed": "kill", "killing": "kill",
    "force": "force", "forces": "force",
    "troop": "troop", "troops": "troop",
    "missile": "missile", "missiles": "missile", "rocket": "missile", "rockets": "missile",
    "bomb": "bomb", "bombs": "bomb", "bombing": "bomb", "bombed": "bomb",
    "protest": "protest", "protests": "protest", "protester": "protest", "protesters": "protest",
}


def _extract_keywords(title: str) -> frozenset[str]:
    """
    Extract significant keywords from title for similarity matching.
    Removes stop words, normalizes variations, and keeps meaningful terms.
    """
    import re
    words = re.findall(r'\b[a-zA-Z]{3,}\b', title.lower())
    # Filter stop words, normalize, and keep unique
    normalized = []
    for w in words:
        if w in _STOP_WORDS:
            continue
        # Normalize if mapping exists
        normalized.append(_WORD_NORMALIZE.get(w, w))
    return frozenset(normalized)


def _title_hash(title: str) -> str:
    """
    Generate a hash of the normalized title for deduplication.
    Uses sorted keywords to be order-independent.
    """
    keywords = _extract_keywords(title)
    # Sort for consistency, join, hash
    normalized = " ".join(sorted(keywords))
    return hashlib.md5(normalized.encode()).hexdigest()[:16]


def titles_similar(title_a: str, title_b: str, threshold: float = 0.6) -> bool:
    """
    Check if two titles are similar using Jaccard similarity on keywords.
    
    threshold: 0.6 means 60% keyword overlap required
    """
    kw_a = _extract_keywords(title_a)
    kw_b = _extract_keywords(title_b)
    
    if not kw_a or not kw_b:
        return False
    
    intersection = len(kw_a & kw_b)
    union = len(kw_a | kw_b)
    
    similarity = intersection / union if union > 0 else 0
    return similarity >= threshold


def fetch_rss_articles(
    max_age_hours: int = 12,
    max_per_feed: int = 25,
) -> list[dict]:
    """
    Fetch articles from all configured RSS feeds.
    
    Args:
        max_age_hours: Only include articles from the last N hours
        max_per_feed: Maximum articles to take from each feed
        
    Returns:
        List of article dicts compatible with the existing enrichment pipeline
    """
    articles: list[RSSArticle] = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
    
    # Track seen URLs and title hashes for deduplication
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    
    feed_stats: dict[str, int] = {}
    
    for feed_id, feed_url in RSS_FEEDS.items():
        feed_name = FEED_NAMES.get(feed_id, feed_id)
        
        try:
            # Parse the feed
            feed = feedparser.parse(feed_url)
            
            if feed.bozo and not feed.entries:
                print(f"  ⚠️ [{feed_name}] Feed error: {feed.bozo_exception}")
                feed_stats[feed_id] = 0
                continue
            
            count = 0
            for entry in feed.entries[:max_per_feed]:
                # Parse timestamp
                published = _parse_timestamp(entry)
                
                # Skip old articles
                if published and published < cutoff:
                    continue
                
                # Get URL and dedupe
                url = entry.get('link', '')
                if not url:
                    continue
                    
                url_normalized = _normalize_url(url)
                if url_normalized in seen_urls:
                    continue
                
                # Get title and dedupe by similarity
                title = entry.get('title', '').strip()
                if not title:
                    continue
                    
                title_h = _title_hash(title)
                if title_h in seen_titles:
                    continue
                
                # Get description/summary
                description = entry.get('summary', entry.get('description', ''))
                if description:
                    # Strip HTML tags (simple approach)
                    description = description.replace('<p>', '').replace('</p>', ' ')
                    description = description.replace('<br>', ' ').replace('<br/>', ' ')
                    # Truncate
                    description = description[:500]
                
                # Extract source name from entry if available (Google News does this)
                source_name = feed_name
                if hasattr(entry, 'source') and hasattr(entry.source, 'title'):
                    source_name = entry.source.title
                
                # Mark as seen
                seen_urls.add(url_normalized)
                seen_titles.add(title_h)
                
                articles.append(RSSArticle(
                    title=title,
                    description=description,
                    url=url,
                    source_name=source_name,
                    published=published or datetime.now(timezone.utc),
                    feed_id=feed_id,
                ))
                count += 1
            
            feed_stats[feed_id] = count
            
        except Exception as e:
            print(f"  ⚠️ [{feed_name}] Error: {type(e).__name__}: {e}")
            feed_stats[feed_id] = 0
    
    # Log stats
    total = len(articles)
    active_feeds = sum(1 for c in feed_stats.values() if c > 0)
    print(f"📡 RSS: Fetched {total} articles from {active_feeds}/{len(RSS_FEEDS)} feeds")
    
    # Log per-feed breakdown if verbose
    for feed_id, count in sorted(feed_stats.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"   • {FEED_NAMES.get(feed_id, feed_id)}: {count}")
    
    # Convert to dict format expected by enrichment pipeline
    return [
        {
            "title": a.title,
            "description": a.description,
            "url": a.url,
            "source": {"name": a.source_name},
            "publishedAt": a.published.isoformat(),
        }
        for a in articles
    ]


def dedupe_articles(articles: list[dict], similarity_threshold: float = 0.6) -> list[dict]:
    """
    Deduplicate articles by URL and title similarity.
    Use this when combining multiple sources (RSS + NewsAPI).
    
    Deduplication layers:
    1. Exact URL match (after normalization)
    2. Title keyword hash (fast check)
    3. Jaccard similarity on keywords (catches rewording)
    """
    seen_urls: set[str] = set()
    seen_title_hashes: set[str] = set()
    seen_keywords: list[frozenset[str]] = []  # For similarity checking
    unique: list[dict] = []
    
    for article in articles:
        url = article.get('url', '')
        title = article.get('title', '')
        
        # Layer 1: URL match
        url_normalized = _normalize_url(url)
        if url_normalized in seen_urls:
            continue
        
        # Layer 2: Exact title hash match (fast path)
        title_h = _title_hash(title)
        if title_h in seen_title_hashes:
            continue
        
        # Layer 3: Keyword similarity (catches rewording)
        keywords = _extract_keywords(title)
        if keywords:
            for seen_kw in seen_keywords:
                intersection = len(keywords & seen_kw)
                union = len(keywords | seen_kw)
                if union > 0 and (intersection / union) >= similarity_threshold:
                    # Similar to an existing article, skip
                    break
            else:
                # No similar article found, keep this one
                seen_urls.add(url_normalized)
                seen_title_hashes.add(title_h)
                seen_keywords.append(keywords)
                unique.append(article)
        else:
            # No keywords extracted (very short title), fall back to hash only
            seen_urls.add(url_normalized)
            seen_title_hashes.add(title_h)
            unique.append(article)
    
    return unique
