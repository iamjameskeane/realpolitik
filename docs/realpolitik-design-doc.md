
**Architecture Specification: Realpolitik Geopolitical Intelligence Platform**
*A distributed, event-sourced intelligence system with multi-modal storage and AI-native interfaces*

---

### 1. Executive Summary

Realpolitik is an event-sourced geopolitical intelligence platform designed to ingest global news via RSS, model relationships in a graph database, enable semantic search via vector embeddings, and provide AI-augmented analysis through both human (Flutter/Web) and agent (MCP) interfaces. The architecture prioritizes **consistency across heterogenous data stores** via the Outbox pattern, **cost amortization** via intelligent caching of LLM analysis, and **horizontal scalability** via stateless services and container orchestration.

---

### 2. Core Architectural Patterns

- **CQRS with Event Sourcing**: Argus writes immutable events to PostgreSQL; read models (Neo4j, Qdrant) are built asynchronously via CDC
- **Outbox Pattern**: Ensures atomic commit of business events and dispatch messages to RabbitMQ
- **Saga Pattern**: Distributed transaction coordination for multi-database writes (compensating transactions on failure)
- **Cache-Aside with Event Invalidation**: Fallout analyses cached with TTL triggered by new related events, not just time
- **BFF (Backend for Frontend)**: Separate API surface for mobile/web vs. MCP agents

---

### 3. Service Topology & Component Interaction

#### 3.1 Ingestion Layer: Argus Engine
*Type: Kubernetes CronJob / Daemon*
*Runtime: Python (asyncio)*

Argus operates as a high-throughput RSS consumer with the following lifecycle:
- **Fetch**: Polls configurable RSS endpoints (news agencies, government feeds) respecting `robots.txt` and rate limits
- **Normalize**: Transforms heterogenous XML/RSS into canonical `GeopoliticalEvent` schema (ISO 8601 timestamps, GEC/geojson coordinates)
- **Enrich**: LLM-based entity extraction (OpenRouter) to identify actors, locations, and severity
- **Persist**: Writes to **PostgreSQL Outbox table** within a transaction—never directly to Neo4j or Qdrant

**Critical Behavior**: Argus is *write-only* to the transactional store. It does not trigger Fallout analyses, nor does it query the graph or vector databases.

#### 3.2 Transactional Core: PostgreSQL (The Source of Truth)
*Role: Event Store, User Management (initially), Outbox Pattern*

Schema Strategy:
- **Events Table**: Append-only `geopolitical_events` with JSONB payload for flexibility
- **Outbox Table**: `outbox` table with `payload`, `destination_topic`, `processed_at` fields
- **Analysis Registry**: `fallout_analyses` table linking event composites to cached LLM responses with `version` and `invalidation_hash`

PostgreSQL acts as the **transaction boundary** for the entire system. All writes to Neo4j and Qdrant originate from the Outbox via Change Data Capture (CDC).

#### 3.3 Change Data Capture (CDC) Pipeline
*Component: Debezium Connector → Kafka (or RabbitMQ Stream)*

- **Debezium** monitors PostgreSQL WAL (Write-Ahead Log) for Outbox table inserts
- **Streaming**: Events flow to a topic exchange (`event.ingested`)
- **Idempotency**: Consumers use event UUIDs for deduplication

*Single-machine optimization*: Can be replaced with `pgmq` (Postgres-native queue) to reduce infrastructure footprint, with migration path to Debezium/Kafka for cluster deployment.

#### 3.4 Fanout Consumers (Saga Participants)
*Type: Worker Pods (stateless)*
*Runtime: Python*

**Neo4j Writer**:
- Consumes `event.ingested`
- Creates/updates nodes: `:Event`, `:Actor`, `:Location`, `:Resource`
- Creates edges: `:AFFECTS`, `:INVOLVES`, `:ESCATASTES_FROM`
- Implements **compensating transactions**: If graph write fails, dead-letters to retry queue; never blocks PG commit

**Qdrant Writer**:
- Generates embeddings (OpenRouter or local embedding model) for semantic search
- Stores vectors with metadata linking back to PG `event_id`
- Enables "Find similar historical events" for Pythia chat

#### 3.5 Application Server (FastAPI)
*Type: Stateful (WebSocket connections) + Stateless (HTTP)*
*Runtime: Python/FastAPI with Uvicorn*

Responsibilities:
- **REST API**: CRUD for events, user subscriptions, analysis requests
- **WebSocket Manager**: Real-time bidirectional communication for Pythia chat sessions (Flutter/Astro clients)
- **Authentication**: JWT validation (Supabase Auth integration)
- **Rate Limiting**: Redis-backed sliding window (separate buckets for humans vs. agents)

**Data Access Strategy**:
- **Read**: Query Optimization—Route queries by pattern:
  - Temporal filters → PostgreSQL
  - Relationship traversals ("Show allies of X") → Neo4j
  - Semantic similarity ("Events like the Suez Crisis") → Qdrant
- **Write**: All writes go to PostgreSQL Outbox (no direct Neo4j/Qdrant writes from App Server)

#### 3.6 MCP (Model Context Protocol) Gateway
*Type: Sidecar/Standalone Service*
*Runtime: Python*

Isolated from main App Server to enforce **capability-based security**:
- **Tool Definition Exposes**:
  - `search_events(query: str, filters: GeoFilter)` → Queries Qdrant + Neo4j
  - `get_event_lineage(event_id)` → Neo4j pathfinding
  - `request_fallout_analysis(event_ids: list)` → Publishes to RabbitMQ (user approval required for cost control)
- **Security**: mTLS + scoped JWTs (agents cannot access user management endpoints)
- **Audit**: All agent actions logged to separate `agent_audit` table

#### 3.7 Fallout Analysis Engine
*Type: Queue Consumer (Horizontal Pod Autoscaler target)*
*Runtime: Python*

The **cost center** of the application—intelligently managed:
- **Trigger**: User-initiated via App Server or MCP (not automatic)
- **Orchestration**: Consumes `analysis.requested` messages from RabbitMQ
- **Context Assembly**: 
  1. Fetches target events from PG
  2. Retrieves related events via Neo4j (2-hop neighborhood)
  3. Performs RAG over Qdrant for historical analogues
  4. Constructs prompt with chain-of-thought reasoning
- **Deduplication**: Checks PG `fallout_analyses` for existing valid analysis (same event composite + no intervening updates)
- **Execution**: Calls OpenRouter with structured output (JSON) for cascading impact analysis
- **Persistence**: Stores result in PG (authoritative) and Redis (cache)
- **Cost Amortization**: If User B requests analysis for Event Set X that User A requested 10 minutes ago and no new events have invalidated it, serves cached version.

**Staleness Implementation**:
- **Event-Based Invalidation**: Argus, when ingesting new events, queries Neo4j for "affects" relationships. If new event touches entities in cached Analysis X, publishes `analysis.invalidate` message. Fallout Worker marks cache entry stale.

#### 3.8 Pythia (Conversational Interface)
*Type: Stateful Service (WebSocket)*
*Runtime: Python/FastAPI*

Chat architecture with memory:
- **Session Management**: Redis-backed session store for conversation history
- **RAG Pipeline**:
  1. User query embedding → Qdrant (retrieve relevant events)
  2. Entity extraction → Neo4j (enrich with current relationships)
  3. Prompt construction with retrieved context
  4. Streaming response via OpenRouter (Server-Sent Events or WebSocket)
- **Memory**: Previous turns stored in PostgreSQL `chat_sessions` table; retrieved per conversation

#### 3.9 Client Tier
- **Web**: Astro (SSG/SSR) with React islands for interactive maps (Neo4j data viz)
- **Mobile**: Flutter consuming REST + WebSocket
- **RSS Output**: Pre-generated XML files stored in object storage (MinIO/S3), updated by Fanout Workers when new events match user subscription criteria

---

### 4. Data Flow Scenarios

#### Scenario A: Breaking News Ingestion (The "Iran Incident")
1. Argus polls Reuters RSS → Parses article → Identifies actors (Iran, Israel) → **Writes to PG Outbox**
2. **PG Commit** succeeds → Debezium captures WAL change
3. **Neo4j Worker**: Creates `(e:Event {id: "evt_123", type: "DiplomaticIncident"})-[:INVOLVES]->(a:Actor {name: "Iran"})`
4. **Qdrant Worker**: Generates embedding for "Consulate attack diplomatic crisis" → stores with `event_id` reference
5. **Invalidation Check**: Neo4j query finds that `evt_123` is within 2 hops of cached Analysis `fall_456` (previous Iran-Israel analysis). Publishes `analysis.invalidate` → Cache cleared.

#### Scenario B: User Requests Fallout Analysis
1. User clicks "Analyze Impact" on Event Set {evt_123, evt_124} → App Server validates subscription tier (Stripe)
2. **PG Check**: Query `fallout_analyses` for exact event set hash → Cache miss (or stale)
3. **MQ Publish**: App Server publishes `analysis.requested` with `event_ids` and `request_id`
4. **Fallout Worker**: Consumes message → Assembles context (PG + Neo4j + Qdrant) → Calls OpenRouter ($0.12 cost)
5. **Storage**: Result stored in PG → Redis cache populated with key `analysis:{hash}:v1`
6. **Response**: Worker pushes completion notification via WebSocket → User sees interactive impact graph (Neo4j visualization)

#### Scenario C: Agent Query via MCP
1. Claude Desktop opens MCP connection to `mcp.realpolitik.local`
2. Agent calls `search_events(query="energy security threats in Red Sea")`
3. **MCP Server**: Embeds query → Qdrant search → Returns 5 events with relationship summaries from Neo4j
4. Agent requests `request_fallout_analysis` → MCP Gateway validates scope → Publishes to MQ (same queue as human requests, but tagged with `source:agent`)
5. Result returned to Agent when complete (async callback pattern)

---

### 5. Storage Topology & Consistency

| Store | Responsibility | Consistency Model | Replication |
|-------|---------------|-------------------|-------------|
| **PostgreSQL** | Events, Users, Outbox, Chat History | **Strong Consistency** (ACID) | Streaming replica (read replicas for App Server) |
| **Neo4j** | Entity relationships, Causal chains | **Eventual Consistency** (via Outbox) | Causal Clustering (Core+Read Replicas) |
| **Qdrant** | Semantic search, embeddings | **Eventual Consistency** | Collection snapshots |
| **Redis** | Session cache, Rate limiting, Fallout cache | **TTL-based** | Single-node or Sentinel |

**Consistency Guarantee**: 
- **Read-Your-Write**: Within 500ms for same client (Outbox replication lag)
- **Causal Consistency**: If Event A caused Event B (logged in PG), Neo4j will reflect relationship within 2s (configurable)

---

### 6. Security Architecture

**Zero-Trust Segmentation**:
- **Edge**: Traefik with Let's Encrypt, WAF rules
- **Service Mesh**: mTLS between services (Linkerd/Istio ready)
- **Network Policies**:
  - Argus can only talk to PG and OpenRouter
  - Fallout Workers can only talk to MQ, PG, Neo4j, Qdrant (no external internet except OpenRouter)
  - MCP Server isolated from Stripe API (prevents agents from accessing billing)

**Data Classification**:
- **Public**: RSS feeds, event summaries
- **Sensitive**: User chat history (encrypted at rest in PG), Stripe tokens (vaulted, never in logs)

---

### 7. Deployment & Orchestration

**Single-Box Mode** (Development/Portfolio):
```yaml
# docker-compose.yml structure
services:
  traefik:     # Reverse proxy, SSL termination
  postgres:    # Master + WAL archiving
  neo4j:       # Single instance, import from CSV on first run
  qdrant:      # Qdrant in Docker with persistent volume
  rabbitmq:    # Management UI enabled, single node
  redis:       # Alpine image
  argus:       # Cron schedule: */15 * * * *
  fallout:     # Scale: 1 replica (can be 0 when no jobs)
  app-server:  # FastAPI, ports 8000
  mcp-server:  # Python MCP SDK
  pythia:      # WebSocket handler (can merge with app-server)
```

**Kubernetes Mode** (Production):
- **Namespaces**: `realpolitik-data` (stateful), `realpolitik-services` (stateless)
- **StatefulSets**: PG, Neo4j, Qdrant with PVCs
- **Deployments**: App Server (HPA: 2-10 replicas), Fallout (KEDA: scale to 0 when queue empty)
- **CronJobs**: Argus (concurrency policy: Forbid)
- **ConfigMaps**: RSS source URLs, OpenRouter model configs
- **Secrets**: Rotating DB credentials, OpenRouter keys (External Secrets Operator)

---

### 8. Observability Stack

- **Traces**: OpenTelemetry → Jaeger (trace from RSS → User screen)
- **Metrics**: Prometheus + Grafana
  - Custom: `geopolitical_events_ingested_total{region="MiddleEast", severity="High"}`
  - Business: `fallout_analysis_cost_usd` (track OpenRouter spend)
  - Performance: `neo4j_query_duration_seconds{complexity="3hop"}`
- **Logs**: Loki, structured JSON with `trace_id`, `event_id`
- **Alerting**: PagerDuty integration for:
  - Argus lag > 30 minutes (missing news)
  - Fallout queue depth > 100 (analysis backlog)
  - Outbox table growing (CDC connector down)

---

### 9. Failure Modes & Mitigations

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| **OpenRouter API down** | Cannot generate Fallout analyses | Circuit breaker: Queue persists jobs, serve stale analyses with warning banner |
| **Neo4j split-brain** | Inconsistent relationship data | Core-specific architecture, automated backups, #skip strategy in queries |
| **PG Outbox clogged** | Event lag to Neo4j/Qdrant | Monitor Outbox table size, alert if >10k unprocessed messages |
| **RabbitMQ partition** | Duplicate analysis generation | Consumer idempotency keys based on event set hash |
| **Agent token leak** | Unauthorized data access | Short-lived tokens (1hr), immediate revocation via JWT blacklist in Redis |

---

### 10. Migration Path from Supabase/Vercel

1. **Auth Retention**: Continue using Supabase Auth (JWT compatible), migrate user IDs to PG `users` table via Foreign Data Wrapper
2. **Strangler Fig**: Run Vercel app and new K8s app side-by-side. Route `/v1/events` to new architecture, `/legacy` to Vercel. Gradual traffic shift via Traefik weights.
3. **Data Migration**: Backfill Neo4j/Qdrant from Supabase PG using one-time Argus replay (treat historical data as RSS ingestion).

---