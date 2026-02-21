"""
Main processing pipeline orchestration.
Argus ingests RSS and stores events with EMPTY fallout_predictions.
Analysis is user-triggered via Delphi → Cassandra microservice.
"""

import asyncio
from ..models.events import GeoEvent, EventSource
from ..sources.rss_feeds import fetch_rss_articles, dedupe_articles
from ..sources.newsapi import fetch_headlines
from ..enrichment import enrich_article, geocode_enriched_articles
from ..cache.articles import get_processed_articles_batch, mark_articles_processed_batch
from ..utils.hashing import get_article_hash, generate_incident_id
from ..regions import get_region
from .grouping import group_by_incident


async def fetch_hybrid_articles(
    geopolitical_keywords: list[str],
    sources: str = "rss"
) -> list[dict]:
    """
    Fetch articles from RSS feeds only (OpenRouter-only system).
    
    Args:
        geopolitical_keywords: Keywords for reference (not used in RSS)
        sources: Which sources to fetch - "rss" (only option now)
    
    Returns deduplicated article list.
    """
    all_articles: list[dict] = []
    
    # RSS Feeds (real-time, free, fast-updating)
    if sources in ("rss", "all"):
        print("\n📡 Fetching from RSS feeds...")
        try:
            # Use 12 hour lookback for comprehensive coverage
            rss_articles = fetch_rss_articles(max_age_hours=12, max_per_feed=25)
            all_articles.extend(rss_articles)
        except Exception as e:
            print(f"  ⚠️ RSS fetch error: {type(e).__name__}: {e}")
    else:
        raise ValueError(f"Invalid sources: {sources}. Only 'rss' is supported in OpenRouter-only mode.")
    
    # Deduplicate articles
    unique_articles = dedupe_articles(all_articles)
    print(f"\n📊 Total: {len(all_articles)} articles → {len(unique_articles)} after deduplication")
    
    return unique_articles


async def process_articles(
    articles: list[dict],
    ai_client,
    config,
    skip_synthesis: bool = False
) -> list[GeoEvent]:
    """
    Process articles: enrich, group by incident, optionally synthesize.
    Uses Redis cache to skip already-processed articles (saves API credits).
    
    Args:
        articles: List of raw article dicts
        ai_client: OpenRouter client wrapper
        config: Config object with all settings
        skip_synthesis: If True, skip synthesis step (for graph-first mode)
    
    Returns:
        List of GeoEvent objects
    """
    # Step 0: Filter out already-processed articles (saves API credits!)
    article_hashes = {get_article_hash(a): a for a in articles}
    already_processed = get_processed_articles_batch(
        config.redis_url,
        config.redis_token,
        list(article_hashes.keys())
    )
    
    new_articles = [
        a for h, a in article_hashes.items() 
        if h not in already_processed
    ]
    
    skipped = len(articles) - len(new_articles)
    if skipped > 0:
        print(f"⏭️  Skipped {skipped} already-processed articles (cached)")
    
    if not new_articles:
        print("📭 No new articles to process")
        return []
    
    semaphore = asyncio.Semaphore(config.max_concurrent_requests)
    
    async def bounded_enrich(article: dict, index: int) -> tuple[dict, any]:
        async with semaphore:
            return await enrich_article(
                ai_client,
                article,
                index,
                len(new_articles),
                config.model_enrichment,
                config
            )
    
    # Step 1: Enrich only NEW articles in parallel
    tasks = [bounded_enrich(article, i) for i, article in enumerate(new_articles)]
    results = await asyncio.gather(*tasks)
    
    # Mark all processed articles in cache (even non-geopolitical ones)
    processed_hashes = [get_article_hash(a) for a, _ in results]
    mark_articles_processed_batch(
        config.redis_url,
        config.redis_token,
        processed_hashes,
        config.processed_article_ttl_hours
    )
    
    # Filter to geopolitical events only
    enriched_articles = [
        (article, enriched)
        for article, enriched in results
        if enriched is not None and enriched.is_geopolitical
    ]

    print(f"\n📊 {len(enriched_articles)} geopolitical articles identified")

    # Step 2: Geocode locations (dedicated step for accuracy)
    enriched_articles = await geocode_enriched_articles(
        ai_client,
        enriched_articles,
        config.model_enrichment,
        config.redis_url,
        None,  # redis_token no longer used
        config.geocode_cache_ttl_days
    )

    # Step 3: Group by incident
    incident_groups = group_by_incident(
        enriched_articles,
        config.get_grouping_distance,
        config.grouping_time_hours
    )
    print(f"🔗 Grouped into {len(incident_groups)} incidents")
    
    # Log source distribution
    multi_source = [g for g in incident_groups if len(g.sources) > 1]
    if multi_source:
        print(f"   ({len(multi_source)} incidents with multiple sources)")
        for g in multi_source:
            print(f"      • {g.category} @ {g.location_name}: {len(g.sources)} sources")
    
    # Step 4: Argus NO LONGER does synthesis - events stored with empty fallout
    # User-triggered analysis happens via Delphi API → Cassandra microservice
    print(f"\n📝 Events stored with empty fallout for user-triggered analysis")
    synthesis_results = [None] * len(incident_groups)
    
    # Build final events
    events: list[GeoEvent] = []
    
    for i, group in enumerate(incident_groups):
        earliest, latest = group.get_timestamps()
        synthesized = synthesis_results[i] if i < len(synthesis_results) else None
        
        if synthesized:
            title = synthesized.title
            summary = synthesized.summary
            severity = synthesized.severity
            fallout = synthesized.fallout_prediction
        else:
            # Fallback if synthesis failed
            src = group.sources[0]
            title = src.headline
            summary = src.summary
            severity = group.get_max_severity()
            fallout = ""  # No fallout without synthesis
        
        # Generate incident ID
        incident_id = generate_incident_id(
            group.category,
            group.lng,
            group.lat,
            earliest,
            config.get_grouping_distance(group.category)
        )
        
        # Extract geographic region for notification filtering
        region = get_region(group.location_name)
        
        # Ensure category is one of the allowed values
        category = str(group.category).upper()
        if category not in ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"]:
            category = "UNREST"  # Default fallback
        
        event = GeoEvent(
            id=incident_id,
            title=title,
            category=category,
            coordinates=(group.lng, group.lat),
            location_name=group.location_name,
            region=region,
            severity=severity,
            summary=summary,
            timestamp=earliest,
            last_updated=latest,
            fallout_prediction=fallout,
            sources=group.sources,
            # CAMEO classification
            cameo_code=group.cameo_code,
            cameo_label=group.cameo_label,
            # Constellation: pass aggregated entities and relationships for graph processing
            entities=group.entities,
            relationships=group.relationships,
        )
        events.append(event)
    
    return events
