# Realpolitik - Distributed Geopolitical Intelligence Platform

> **Olympian Architecture** - A fully distributed, event-sourced intelligence system with multi-modal storage and AI-native interfaces

## 🏛️ Architecture Overview

Realpolitik implements a **fully distributed system** with CQRS, Event Sourcing, and the Outbox Pattern:

```
RSS Feeds → Argus → PostgreSQL (Outbox) → CDC → RabbitMQ → 
[Neo4j Consumer] [Qdrant Consumer] [Fallout Worker] ← Delphi ← Clients
```

### The Olympian Pantheon

**Data Layer (Titans):**
- **Atlas** (PostgreSQL) - Source of truth, event store, outbox pattern
- **Ariadne** (Neo4j) - Graph relationships, entity traversal  
- **Mnemosyne** (Qdrant) - Vector embeddings, semantic search
- **Lethe** (Redis) - Ephemeral cache, session storage

**Processing Services (Olympians):**
- **Argus** (RSS Ingestion) - Event sourcing, write-only to PostgreSQL
- **Chronos** (CDC Pipeline) - Debezium → Kafka/RabbitMQ
- **Clio** (Neo4j Writer) - Graph relationship updates
- **Urania** (Qdrant Writer) - Vector embedding updates
- **Cassandra** (Fallout Engine) - AI analysis worker

**API Layer:**
- **Delphi** (FastAPI) - Main app server, REST/WebSocket
- **Pythia** (Chat Service) - RAG-powered conversational interface
- **Hermes** (MCP Server) - AI agent gateway
- **Styx** (Edge Gateway) - Traefik API gateway

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- Poetry (dependency management)

### Development Setup

```bash
# Clone and setup
git clone <repo>
cd realpolitik

# Install dependencies
task setup

# Start all services
task up

# Run individual services
task dev-argus    # RSS ingestion
task dev-delphi   # API server  
task dev-pythia   # Chat service
task dev-hermes   # MCP gateway
```

### Service Development

Each service is independently runnable:

```bash
cd apps/argus && poetry run python -m argus.main
cd apps/delphi && poetry run uvicorn src.delphi.main:app --reload
cd apps/pythia && poetry run uvicorn src.pythia.main:app --reload
```

## 📁 Project Structure

```
realpolitik/
├── 📁 apps/                    # Runnable services (containers)
│   ├── argus/                  # RSS Ingestion (CronJob)
│   ├── delphi/                 # FastAPI App Server
│   ├── pythia/                 # Chat Service (WebSocket + RAG)
│   ├── hermes/                 # MCP Server
│   ├── cassandra/              # Fallout Analysis Worker
│   ├── clio/                   # Neo4j Writer
│   ├── urania/                 # Qdrant Writer
│   └── chronos/                # CDC Pipeline
│
├── 📁 libs/                    # Shared libraries
│   ├── realpolitik-schema/     # Canonical data models
│   ├── realpolitik-clients/    # Database clients
│   └── realpolitik-observability/ # Shared Otel setup
│
├── 📁 infra/                   # Infrastructure as Code
│   ├── k8s/                    # Kubernetes manifests
│   └── terraform/              # Cloud provisioning
│
├── 📁 schemas/                 # Event contracts (language agnostic)
├── 📁 notebooks/              # Exploration & Data Science
└── 📁 docs/                   # Architecture documentation
```

## 🔧 Architecture Patterns

- **CQRS with Event Sourcing**: Argus writes immutable events to PostgreSQL; read models built asynchronously
- **Outbox Pattern**: Ensures atomic commit of business events and dispatch to RabbitMQ
- **Saga Pattern**: Distributed transaction coordination with compensating transactions
- **Event-Driven**: All inter-service communication via message queues
- **Cache-Aside**: LLM analyses cached with TTL triggered by new events

## 📊 Data Flow

### Event Ingestion Pipeline
1. **Argus** polls RSS feeds → PostgreSQL (Outbox)
2. **Chronos** captures WAL → RabbitMQ
3. **Clio** → Neo4j (graph relationships)
4. **Urania** → Qdrant (embeddings)

### Analysis Request Pipeline
1. **Delphi** receives user request → RabbitMQ
2. **Cassandra** consumes → assembles context → OpenRouter
3. Result cached in **Redis** + stored in **PostgreSQL**

### Chat Interface
1. **Pythia** receives WebSocket connection
2. RAG over **Qdrant** + **Neo4j**
3. Response via **OpenRouter**

## 🔒 Security

- **Zero-Trust**: mTLS between services, capability-based access
- **Data Classification**: Public events, sensitive user data
- **Agent Isolation**: MCP gateway separated from billing/sensitive APIs

## 📈 Scaling

- **Stateless Services**: All compute services scale horizontally
- **Message Queue**: Decouples processing for resilience
- **Eventual Consistency**: Cross-database synchronization
- **Cost Optimization**: Intelligent LLM caching

## 🧪 Testing

```bash
task test        # All tests
task test-unit   # Unit tests only
task test-integration  # Integration tests
```

## 📚 Documentation

- **[Architecture](./docs/system-architecture.md)** - Visual system diagram
- **[Design Document](./docs/realpolitik-design-doc.md)** - Detailed technical specification
- **[Repository Structure](./docs/repo-structure.md)** - Monorepo organization
- **[Naming Conventions](./docs/naming-conventions-doc.md)** - Olympian pantheon

## 🤝 Contributing

1. Follow the **Olympian naming** convention for new services
2. Implement **Outbox Pattern** for all database writes
3. Use **event-sourced** architecture for state changes
4. Add **observability** (traces, metrics, logs) to all services
5. Write **tests** for all new functionality

## 📄 License

MIT License - See LICENSE file for details.