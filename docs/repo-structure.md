realpolitik/
├── 📁 apps/                          # Runnable services (containers)
│   ├── 📁 argus/                     # RSS Ingestion (CronJob)
│   │   ├── src/
│   │   │   └── argus/
│   │   │       ├── __init__.py
│   │   │       ├── main.py           # Entry point
│   │   │       ├── fetcher.py        # RSS logic
│   │   │       └── normalizer.py     # Canonical event schema
│   │   ├── tests/
│   │   ├── pyproject.toml            # Poetry deps
│   │   ├── Dockerfile
│   │   └── k8s/
│   │       ├── cronjob.yaml
│   │       └── configmap.yaml        # RSS source URLs
│   │
│   ├── 📁 delphi/                    # FastAPI App Server (REST/WebSocket)
│   │   ├── src/delphi/
│   │   │   ├── api/
│   │   │   │   ├── routes/           # events.py, analysis.py, auth.py
│   │   │   │   └── dependencies.py     # DB sessions, auth
│   │   │   ├── services/             # Business logic
│   │   │   ├── websocket/            # Pythia connection manager
│   │   │   └── main.py
│   │   ├── migrations/               # Alembic (for Atlas schema)
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   └── pyproject.toml
│   │
│   ├── 📁 pythia/                    # Chat Service (WebSocket + RAG)
│   │   ├── src/pythia/
│   │   │   ├── engine.py             # RAG pipeline
│   │   │   ├── memory.py             # Chat history management
│   │   │   └── sockets.py            # Socket.io/WS handlers
│   │   └── pyproject.toml
│   │
│   ├── 📁 hermes/                    # MCP Server
│   │   ├── src/hermes/
│   │   │   ├── server.py             # MCP SDK setup
│   │   │   ├── tools/                # Tool definitions (search_events, etc.)
│   │   │   └── security.py           # Agent token validation
│   │   └── pyproject.toml
│   │
│   ├── 📁 cassandra/                 # Fallout Analysis Worker (Queue Consumer)
│   │   ├── src/cassandra/
│   │   │   ├── consumer.py           # RabbitMQ consumer
│   │   │   ├── analyzer.py           # LLM orchestration
│   │   │   └── context_builder.py    # Assembles PG+Neo4j+Qdrant context
│   │   └── pyproject.toml
│   │
│   ├── 📁 clio/                      # Neo4j Writer (Consumer)
│   │   ├── src/clio/
│   │   │   ├── consumer.py
│   │   │   └── graph_builder.py      # Cypher query builder
│   │   └── pyproject.toml
│   │
│   ├── 📁 urania/                    # Qdrant Writer (Consumer)
│   │   ├── src/urania/
│   │   │   ├── consumer.py
│   │   │   └── embedder.py           # OpenRouter/embedding logic
│   │   └── pyproject.toml
│   │
│   └── 📁 chronos/                   # CDC Pipeline (Optional custom wrapper)
│       ├── src/chronos/              # If extending Debezium, else just configs
│       └── config/
│           └── connector.json        # Debezium PG connector config
│
├── 📁 libs/                          # Shared libraries (internal packages)
│   ├── 📁 realpolitik-schema/        # Canonical data models
│   │   ├── src/realpolitik_schema/
│   │   │   ├── events.py             # Pydantic: GeopoliticalEvent
│   │   │   ├── analysis.py           # Pydantic: FalloutAnalysis
│   │   │   ├── messages.py           # RabbitMQ message contracts
│   │   │   └── enums.py              # Severity, Region, EventType
│   │   └── pyproject.toml
│   │
│   ├── 📁 realpolitik-clients/       # Database clients
│   │   ├── src/realpolitik_clients/
│   │   │   ├── atlas.py              # PG client + outbox writer
│   │   │   ├── ariadne.py            # Neo4j driver wrapper
│   │   │   ├── mnemosyne.py          # Qdrant client
│   │   │   ├── lethe.py              # Redis client
│   │   │   └── iris.py               # RabbitMQ publisher/consumer base
│   │   └── pyproject.toml
│   │
│   └── 📁 realpolitik-observability/ # Shared Otel setup
│       ├── src/realpolitik_observability/
│       │   ├── tracing.py
│       │   └── logging.py
│       └── pyproject.toml
│
├── 📁 infra/                         # Infrastructure as Code
│   ├── 📁 k8s/                       # Kubernetes manifests (kustomize)
│   │   ├── base/
│   │   │   ├── atlas/                # PG StatefulSet + PVC
│   │   │   ├── ariadne/              # Neo4j
│   │   │   ├── mnemosyne/            # Qdrant
│   │   │   ├── lethe/                # Redis
│   │   │   ├── iris/                 # RabbitMQ
│   │   │   ├── styx/                 # Traefik/Ingress
│   │   │   ├── delphi/
│   │   │   ├── cassandra/
│   │   │   └── kustomization.yaml
│   │   └── overlays/
│   │       ├── dev/
│   │       ├── staging/
│   │       └── production/
│   │
│   ├── 📁 terraform/                 # Cloud provisioning (if needed)
│   │   ├── modules/
│   │   └── main.tf
│   │
│   └── 📁 scripts/                   # Utility scripts
│       ├── seed-local.sh             # Load sample geopolitical data
│       └── setup-CDC.sh
│
├── 📁 schemas/                       # Event contracts (language agnostic)
│   ├── events/
│   │   ├── geopolitical_event_v1.avro
│   │   └── fallout_analysis_requested_v1.avro
│   └── proto/                        # If you switch to gRPC later
│
├── 📁 notebooks/                     # Exploration & Data Science
│   └── entity_resolution.ipynb       # Jupyter: testing NER strategies
│
├── 📁 docs/
│   ├── architecture/
│   │   ├── ADR-001-outbox-pattern.md
│   │   ├── ADR-002-embedding-strategy.md
│   │   └── runbooks/
│   └── api/                          # OpenAPI specs (generated or manually curated)
│
├── 📁 .github/
│   └── workflows/
│       ├── ci.yaml                   # Lint, test, build per service
│       ├── argus-deploy.yaml
│       └── delphi-deploy.yaml
│
├── 📄 docker-compose.yml             # Local development (one machine)
├── 📄 docker-compose.override.yml    # Dev overrides (volume mounts)
├── 📄 Taskfile.yml                   # Task runner (go-task) or Makefile
├── 📄 pyproject.toml                 # Root workspace config (Poetry/PDM)
├── 📄 README.md                      # Architecture diagram + quickstart
└── 📄 .python-version