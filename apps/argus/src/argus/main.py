"""
Argus - The Intelligence Engine for Realpolitik
================================================
All-seeing, ever-vigilant.

Monitors global news sources, enriches with AI analysis, extracts entities and
relationships, and builds a living knowledge graph of geopolitical connections.

Data Pipeline:
    RSS Feeds (real-time) → Enrichment → Entity Extraction → Embeddings → Graph Storage
    NewsAPI (backup)      ↗       ↓              ↓              ↓            ↓
                              Category      Entities +    768d vectors  →  Nodes
                              Severity      Relationships                →  Edges
                              Summary                                    →  Links
                              Fallout

AI Stack:
    - OpenRouter (Claude models): Article enrichment + entity extraction
    - OpenRouter embeddings: Semantic embeddings (768d entities, 1536d events)

Knowledge Graph (Constellation):
    - Two-pass entity resolution (alias → semantic)
    - Multi-dimensional edge weights (percentage, confidence, freshness, evidence, polarity)
    - Temporal relationships with validity ranges

Usage:
    python main.py                    # Local JSON output
    python main.py --output supabase  # Production (Supabase + graph)
    python main.py --sources rss      # RSS only (faster)

Copyright (c) 2026 Realpolitik. All Rights Reserved.
"""

import argparse
import asyncio
import os
import sys
import time

from .config import Config, GEOPOLITICAL_KEYWORDS
from .enrichment import AIClient, QuotaExhaustedError
from .pipeline import process_articles, fetch_hybrid_articles
from .storage import write_local, write_database, update_event_fallout
from .notifications import notify_high_severity_events


async def async_main(sources: str = "all"):
    """
    Async main entry point.
    
    Args:
        sources: Which sources to fetch - "rss", "newsapi", or "all"
    """
    print("=" * 60)
    mode_label = {
        "rss": "RSS Only (fast update)",
        "newsapi": "NewsAPI Only",
        "all": "RSS + NewsAPI Hybrid"
    }.get(sources, "RSS + NewsAPI Hybrid")
    print(f"🌍 REALPOLITIK WORKER ({mode_label})")
    print("=" * 60)
    
    # Load configuration
    config = Config.from_env()
    config.validate()
    
    # Log configuration
    # Log database configuration
    db_info = config.get_database_info()
    print(f"\n📋 Configuration:")
    print(f"   AI Models: {config.model_enrichment} (enrich) / {config.model_synthesis} (synthesis)")
    print(f"   Thinking: {config.thinking_level}")
    print(f"   Storage: {config.storage_mode}")
    print(f"   Graph: entities={config.enable_entities}, embeddings={config.enable_embeddings}, storage={config.enable_graph_storage}")
    print(f"   Databases:")
    print(f"     Atlas (PostgreSQL): {'✓' if db_info['atlas']['connected'] else '✗'}")
    print(f"     Ariadne (Neo4j): {'✓' if db_info['ariadne']['connected'] else '✗'}")
    print(f"     Mnemosyne (Qdrant): {'✓' if db_info['mnemosyne']['connected'] else '✗'}")
    print(f"     Lethe (Redis): {'✓' if db_info['lethe']['connected'] else '✗'}")
    print(f"     Iris (RabbitMQ): {'✓' if db_info['iris']['connected'] else '✗'}")
    print(f"   Push: {'configured' if config.push_api_url else 'NOT configured'}")
    
    # Initialize AI client (OpenRouter-only)
    ai_client = AIClient(config)
    
    # Pre-flight check: verify AI API is available before doing any work
    await ai_client.check_quota()
    
    # Get provider info for logging
    provider_info = ai_client.get_model_info()
    print(f"   Using {provider_info['provider']} provider:")
    print(f"   - Enrichment model: {provider_info['enrichment_model']}")
    print(f"   - Synthesis model: {provider_info['synthesis_model']}")
    
    # Fetch articles from RSS feeds only
    articles = await fetch_hybrid_articles(
        GEOPOLITICAL_KEYWORDS,
        sources="rss"  # Only RSS supported
    )
    
    # No external client needed for database mode - direct PostgreSQL connection
    
    # GRAPH-FIRST PIPELINE: enrich/group → write → graph → synthesize → update
    # This allows synthesis to query the actual relationship network around THIS event
    
    # Determine if we should use graph-first mode (database + graph enabled)
    use_graph_first = config.storage_mode == "database" and config.enable_graph_storage
    
    # Step 1: Process articles (enrich + group, skip synthesis in graph-first mode)
    print(f"\n🤖 Enriching with OpenRouter ({config.max_concurrent_requests} concurrent)...")
    start_time = time.time()
    events = await process_articles(
        articles, 
        ai_client, 
        config,
        skip_synthesis=use_graph_first  # Skip synthesis if graph-first
    )
    elapsed = time.time() - start_time
    print(f"\n⏱️  Enrichment completed in {elapsed:.1f}s")
    
    # Step 2: Write events to database using outbox pattern for CDC
    if config.storage_mode == "database":
        final_events = await write_database(
            events,
            config.database_url,
            enable_graph_storage=config.enable_graph_storage,
            enable_embeddings=config.enable_embeddings
        )
    else:
        # Local mode - synthesis already happened
        final_events = await write_local(
            events,
            config.output_path,
            ai_client,
            config.max_events,
            config.severity_bonus_hours,
            config.model_synthesis
        )
    
    # Step 3: Graph processing is now handled via RabbitMQ fanout
    # Neo4j (Ariadne) and Qdrant (Mnemosyne) processing happens in dedicated workers
    if config.enable_graph_storage and config.storage_mode == "database" and final_events:
        print(f"\n🕸️  Graph processing delegated to fanout workers:")
        print(f"     Neo4j (Ariadne): entities={config.enable_entities}, relationships=True")
        print(f"     Qdrant (Mnemosyne): embeddings={config.enable_embeddings}")
        print(f"     Fanout via Iris (RabbitMQ) completed")
    
    # Step 4: Argus does NO synthesis - user-triggered analysis via Delphi → Cassandra
    # Events are stored with empty fallout_predictions for later enhancement
    if final_events:
        print(f"\n📊 Events stored with empty fallout_predictions")
        print(f"   Users can request analysis via Delphi API → Cassandra microservice")
        print(f"   Enhanced fallout will be added asynchronously by Cassandra worker")
    
    # Step 5: Causal linking handled by Clio worker via RabbitMQ
    # Neo4j-based relationship analysis between events
    if config.enable_graph_storage and config.storage_mode == "database" and final_events:
        print(f"\n🔗 Causal linking delegated to Clio worker")
        print(f"     Neo4j will establish temporal relationships between events")
    
    # Send push notifications using FINAL merged events (not pre-merge incidents)
    # This ensures notification IDs match the events in events.json
    if final_events:
        notify_high_severity_events(
            final_events,
            config.push_api_url,
            config.push_api_secret,
            config.push_notification_threshold,
            config.push_critical_threshold,
            config.push_max_age_hours
        )
    else:
        print("\n📲 PUSH NOTIFICATIONS: No events to process")
    
    # Summary
    total_time = time.time() - start_time
    print("\n" + "=" * 60)
    print("✅ PIPELINE COMPLETE")
    print("=" * 60)
    print(f"   Events written: {len(final_events) if final_events else 0}")
    print(f"   Total time: {total_time:.1f}s")
    print("=" * 60)


def main():
    """Sync wrapper for async main with argument parsing and error handling."""
    parser = argparse.ArgumentParser(
        description="Realpolitik Worker - Fetch and enrich geopolitical news"
    )
    parser.add_argument(
        "--sources",
        choices=["rss", "newsapi", "all"],
        default="rss",
        help="Which sources to fetch: rss (default), newsapi, or all"
    )
    parser.add_argument(
        "--output",
        choices=["local", "supabase"],
        default=None,
        help="Override output destination (default: auto-detect from env)"
    )
    
    args = parser.parse_args()
    
    # Override storage mode if specified
    if args.output:
        os.environ["STORAGE_MODE"] = args.output
    
    try:
        asyncio.run(async_main(sources=args.sources))
    except QuotaExhaustedError as e:
        print("\n" + "=" * 60)
        print("❌ ERROR: Gemini Quota Exhausted (Pre-flight Check)")
        print("=" * 60)
        print(f"\nDetails: {e}")
        print("\nThe worker detected that your Gemini API quota is exhausted")
        print("BEFORE starting to process articles. No work was done.")
        print("\nAction required:")
        print("  1. Go to https://openrouter.ai/keys")
        print("  2. Check your quota and billing settings")
        print("  3. Re-run this workflow")
        print("=" * 60)
        sys.exit(1)
    
    except Exception as e:
        error_msg = str(e).lower()
        print("\n" + "=" * 60)
        
        # Check for quota/rate limit errors in the exception message
        if "quota" in error_msg or "resource_exhausted" in error_msg or "429" in str(e):
            print("❌ ERROR: Gemini Rate Limit / Quota Exceeded")
            print("=" * 60)
            print(f"\nDetails: {e}")
            print("\nPossible causes:")
            print("  1. Too many requests to Gemini API")
            print("  2. Daily quota limit reached")
            print("\nRecommendation: Wait a few minutes and try again.")
        else:
            print("❌ ERROR: Unexpected Error")
            print("=" * 60)
            print(f"\nType: {type(e).__name__}")
            print(f"Details: {e}")
            print("\nPlease check the logs above for more context.")
        
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    main()
