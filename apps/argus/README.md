# Argus

  **The intelligence engine for Realpolitik**

  > "All-seeing, ever-vigilant" - Argus monitors global events and builds a living knowledge graph of geopolitical relationships.

---

## Overview

Argus is the closed-source data pipeline and AI engine that powers [Realpolitik](https://realpolitik.world). It:

- **Monitors** global news from 50+ RSS feeds and NewsAPI
- **Enriches** articles with AI analysis (Gemini 2.5 Flash)
- **Extracts** entities and relationships for knowledge graph
- **Synthesizes** multi-source events with fallout predictions
- **Generates** embeddings for semantic search (768d entities, 1536d events)
- **Resolves** entities to canonical form (two-pass: alias → semantic)
- **Builds** temporal knowledge graph with multi-dimensional edge weights

---

## Architecture

```
RSS Feeds → Enrichment → Entity Extraction → Embeddings → Resolution → Graph Storage
                ↓              ↓                  ↓             ↓            ↓
           Category      Entities +         768d vectors  → Canonical  →  Nodes
           Severity      Relationships                    → Entities   →  Edges
           Summary                                                      →  Links
           Fallout
```

### Key Features

**Intelligence Pipeline:**
- Gemini 2.5 Flash for enrichment & entity extraction
- gemini-embedding-001 for semantic embeddings
- Automatic incident grouping (category + location + time)
- Multi-source synthesis with credibility weighting

**Knowledge Graph (Constellation):**
- 10 entity types (country, company, leader, organization, facility, chokepoint, commodity, product, weapon_system, alliance)
- Multi-dimensional edge weights (percentage, confidence, freshness, evidence, polarity)
- Temporal relationships with validity ranges
- Two-pass entity resolution (alias lookup → vector similarity)
- Hub node detection & traversal optimization

**Production Features:**
- Async/parallel processing (10 concurrent enrichments)
- Redis caching for deduplication
- Push notifications via API
- Multiple storage backends (Supabase, local)
- Comprehensive error handling & retry logic

---

## Tech Stack

- **Language**: Python 3.11+
- **AI**: Google Gemini (2.5 Flash + Embedding-001)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Cache**: Redis (Upstash)
- **Storage**: Supabase (PostgreSQL)
- **Framework**: asyncio, httpx, pydantic

---

## Project Structure

```
argus/
├── main.py                    # Entry point (180 lines)
├── config.py                  # Configuration management
│
├── models/                    # Pydantic schemas
│   ├── articles.py            # EnrichedArticle
│   ├── events.py              # GeoEvent, SynthesizedEvent
│   ├── locations.py           # GeocodedLocation
│   └── entities.py            # ExtractedEntity, ExtractedRelationship
│
├── sources/                   # Data fetching
│   ├── rss_feeds.py          # RSS feed parsing
│   └── newsapi.py            # NewsAPI client
│
├── enrichment/                # AI processing
│   ├── client.py             # Gemini wrapper
│   ├── prompts.py            # LLM prompts
│   ├── article.py            # Article enrichment
│   ├── geocoding.py          # Location resolution
│   ├── synthesis.py          # Multi-source synthesis
│   └── entities.py           # Entity extraction
│
├── graph/                     # Knowledge graph (Constellation)
│   ├── embeddings.py         # Embedding generation
│   ├── resolution.py         # Entity resolution
│   ├── nodes.py              # Node operations
│   └── edges.py              # Edge operations
│
├── pipeline/                  # Orchestration
│   ├── grouping.py           # Incident clustering
│   ├── processing.py         # Main pipeline
│   └── graph_processing.py   # Graph integration
│
├── storage/                   # Output backends
│   ├── supabase.py           # Supabase storage
│   └── local.py              # Local JSON
│
├── cache/                     # Caching layer
│   ├── redis.py              # Redis client
│   ├── articles.py           # Article deduplication
│   └── geocodes.py           # Geocode caching
│
├── notifications/             # Push notifications
│   └── push.py               # Notification delivery
│
└── utils/                     # Shared utilities
    ├── validation.py         # Value clamping
    ├── text.py               # Text cleaning
    └── hashing.py            # ID generation
```

---

## Documentation

- **[REFACTOR_SUMMARY.md](./docs/REFACTOR_SUMMARY.md)** - Architecture overview
- **[CONSTELLATION_IMPLEMENTATION.md](./docs/CONSTELLATION_IMPLEMENTATION.md)** - Knowledge graph guide
- **[plans/](./plans/)** - Detailed planning documents
  - `worker-refactor-plan.md` - Refactoring architecture
  - `constellation-parameters.md` - Engineering parameters
  - `constellation-primer.md` - Concepts & theory

---

## Environment Variables

### Required

```bash
GEMINI_API_KEY=...                    # Google AI Studio
NEXT_PUBLIC_SUPABASE_URL=...          # Supabase project
SUPABASE_SERVICE_ROLE_KEY=...         # Supabase service key
```

### Optional

```bash
# NewsAPI (backup source)
NEWSAPI_KEY=...

# Redis (caching)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Push notifications
PUSH_API_SECRET=...
PUSH_API_URL=https://realpolitik.world/api/push/send

# Constellation features
ENABLE_ENTITIES=true
ENABLE_EMBEDDINGS=true
ENABLE_GRAPH_STORAGE=true

# Storage
STORAGE_MODE=supabase  # or 'local'
```

---

## Usage

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your keys

# Run with RSS sources only (faster)
python main.py --sources rss --output local

# Run full pipeline
python main.py --sources all --output supabase
```

### Production

```bash
# Run as cron job (every 15 minutes)
*/15 * * * * cd /home/james/argus && python main.py --sources all --output supabase

# Or use GitHub Actions (see /.github/workflows/update-intel.yml)
```

---

## Performance

### Latency
- **Article enrichment**: ~1-2s per article
- **Entity extraction**: ~0s (same LLM call)
- **Embedding generation**: ~500ms per event (batch of 5 entities)
- **Entity resolution**: ~200ms per entity (alias: <10ms, semantic: 100-300ms)
- **Graph storage**: ~500ms per event
- **Total pipeline**: ~3s per event

### Cost (Monthly @ 96 cycles/day, 40 events/cycle)
- **Enrichment**: ~$115 (gemini-2.5-flash)
- **Entity embeddings**: ~$12 (gemini-embedding-001)
- **Event embeddings**: ~$2 (gemini-embedding-001)
- **Total**: ~$130/month

### Throughput
- **Articles processed**: ~300-500 per cycle
- **Events created**: ~40 per cycle (after filtering)
- **Entities extracted**: ~5 per event average
- **Edges created**: ~3 per event average

---

## Database Schema

See `/supabase/migrations/` in the Realpolitik repository for:
- `20260126185244_atlas_foundation.sql` - Events & reactions
- `20260127000000_constellation_enhancements.sql` - Knowledge graph

---

## License

**Proprietary - All Rights Reserved**

This is closed-source software. Unauthorized copying, distribution, or use is prohibited.

For licensing inquiries, contact the Realpolitik team.

---

## Credits

Built with:
- Google Gemini AI
- Supabase
- Python ecosystem

---

**Argus**: Watching the world, understanding the connections.
