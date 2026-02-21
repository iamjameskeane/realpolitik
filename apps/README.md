# Realpolitik Apps

This directory contains all the Olympian services of the Realpolitik distributed intelligence platform.

## Services (The Olympians)

### API Layer
- **Delphi** - FastAPI application server (Port 8000)
- **Pythia** - WebSocket chat service (Port 8001) 
- **Hermes** - MCP gateway for AI agents (Port 8002)
- **Styx** - API Gateway (Port 8080) ✨ **NEW**

### Processing Services
- **Argus** - RSS ingestion and event sourcing
- **Chronos** - Change Data Capture pipeline
- **Clio** - Neo4j relationship writer
- **Urania** - Qdrant vector embedding writer
- **Cassandra** - AI analysis engine

### Edge Services  
- **Aegis** - Authentication and authorization
- **Agora** - Public API and webhooks

## Development

Each service can be developed and tested independently:

```bash
# Individual service development
task dev-delphi   # FastAPI app server
task dev-pythia   # WebSocket chat
task dev-hermes   # MCP gateway  
task dev-styx     # API gateway
task dev-argus    # RSS ingestion
```

## Docker Development

```bash
# Start specific service
docker-compose up delphi
docker-compose up hermes
docker-compose up styx

# Build all services
task build-all

# Run integration tests
task test-integration
```

## Architecture

All services follow the **Olympian Pantheon** architecture:
- Event-sourced data flow
- CQRS pattern with async processing
- Message queue integration (RabbitMQ)
- Multi-database topology (PostgreSQL, Neo4j, Qdrant, Redis)
- Kubernetes-native deployment
- Zero-trust security model

See the main [Realpolitik README](../../README.md) for full architecture details.