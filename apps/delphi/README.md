# Delphi - Application Server

**The great temple** - Delphi serves as the main API gateway and business logic center.

## Responsibilities

- **REST API**: CRUD for events, user subscriptions, analysis requests
- **WebSocket Manager**: Real-time communication for Pythia chat
- **Authentication**: JWT validation (Supabase Auth integration)
- **Rate Limiting**: Redis-backed sliding window
- **Query Routing**: Directs requests to appropriate data stores

## API Surface

```typescript
// REST Endpoints
GET    /api/v1/events              // List events with filters
GET    /api/v1/events/:id          // Get specific event
POST   /api/v1/analysis/request    // Request fallout analysis
GET    /api/v1/analysis/:id        // Get analysis results
GET    /api/v1/entities/:id        // Entity details with relationships

// WebSocket Endpoints
WS     /ws/chat/:session_id        // Pythia chat sessions
```

## Query Routing Strategy

| Query Pattern | Data Store | Rationale |
|--------------|------------|-----------|
| Temporal filters | PostgreSQL | Best for time-based queries |
| Relationship traversals | Neo4j | Graph queries excel at connections |
| Semantic similarity | Qdrant | Vector search for "similar events" |
| Session/cache | Redis | Fast ephemeral data access |

## Service Configuration

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: delphi
spec:
  replicas: 3
  selector:
    matchLabels:
      app: delphi
  template:
    spec:
      containers:
      - name: delphi
        image: realpolitik/delphi:latest
        ports:
        - containerPort: 8000
        env:
        - DATABASE_URL: postgresql://...
        - NEO4J_URI: bolt://...
        - QDRANT_URI: http://...
        - REDIS_URL: redis://...
```

## Development

```bash
# Run with hot reload
task dev-delphi

# Direct with poetry
cd apps/delphi && poetry run uvicorn src.delphi.main:app --reload
```

## Security

- **JWT validation** for all protected endpoints
- **Rate limiting** by user/IP/endpoint
- **Input validation** with Pydantic schemas
- **Output sanitization** to prevent injection

## Dependencies

- PostgreSQL (Atlas) for transactional data
- Neo4j (Ariadne) for relationship queries
- Qdrant (Mnemosyne) for semantic search
- Redis (Lethe) for caching and rate limiting
- RabbitMQ (Iris) for async analysis requests