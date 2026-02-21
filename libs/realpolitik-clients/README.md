# Realpolitik Client Library

**Database clients** for accessing all Realpolitik data stores.

## Overview

This library provides **asynchronous clients** for all Realpolitik data stores:

- **Atlas**: PostgreSQL client with outbox pattern support
- **Ariadne**: Neo4j driver with graph operations
- **Mnemosyne**: Qdrant client for vector search
- **Lethe**: Redis client for caching and sessions
- **Iris**: RabbitMQ client for message publishing/consumption

## Usage Examples

### Atlas (PostgreSQL)

```python
from realpolitik_clients import AtlasClient

atlas = AtlasClient("postgresql://...")

# Write event (with outbox pattern)
event_data = {...}  # RealpolitikEvent dict
outbox_id = await atlas.write_event(event_data)

# Read events
events = await atlas.get_events(
    limit=10,
    category="MILITARY",
    region="MIDDLE_EAST"
)

# Store analysis
await atlas.store_analysis(request_id, analysis_data)
```

### Ariadne (Neo4j)

```python
from realpolitik_clients import AriadneClient

ariadne = AriadneClient("bolt://localhost:7687", "neo4j", "password")

# Create event node
await ariadne.create_event_node(event_data)

# Find entity neighbors
neighbors = await ariadne.find_entity_neighbors(
    entity_id="usa",
    max_depth=2
)

# Find causal chains
causes = await ariadne.find_event_causes(event_id="evt-123")
```

### Mnemosyne (Qdrant)

```python
from realpolitik_clients import MnemosyneClient

mnemosyne = MnemosyneClient("localhost", 6333)

# Insert event embedding
await mnemosyne.insert_event_embedding(
    event_id="evt-123",
    embedding=event_embedding,
    event_data=event_data
)

# Search similar events
similar = await mnemosyne.search_similar_events(
    query_embedding=query_embedding,
    limit=5,
    score_threshold=0.8,
    filters={"category": "MILITARY"}
)
```

### Lethe (Redis)

```python
from realpolitik_clients import LetheClient

lethe = LetheClient("redis://localhost:6379")
await lethe.connect()

# Cache analysis
await lethe.cache_analysis(
    cache_key="analysis:evt-123:v1",
    analysis_data=analysis,
    ttl=3600
)

# Session management
await lethe.store_session(
    session_id="chat-456",
    session_data={"messages": [...], "context": {...}},
    ttl=3600
)

# Rate limiting
rate_check = await lethe.check_rate_limit(
    user_id="user-789",
    endpoint="/api/events",
    limit=100,
    window=3600
)
```

### Iris (RabbitMQ)

```python
from realpolitik_clients import IrisClient

iris = IrisClient("amqp://localhost:5672")
await iris.connect()

# Publish event
await iris.publish_event(event_data)

# Publish analysis request
await iris.publish_analysis_request(request_data)

# Consume from queue
def analysis_callback(message):
    print(f"Analysis completed: {message}")

iris.consume_queue("analysis.completed", analysis_callback)
iris.start_consuming()
```

## Connection Management

### Async Context Managers

```python
async with AtlasClient("postgresql://...") as atlas:
    events = await atlas.get_events(limit=5)
    analysis = await atlas.store_analysis(request_id, analysis_data)
# Connection automatically closed
```

### Connection Pooling

```python
atlas = AtlasClient("postgresql://...")
await atlas.connect()

# Use connection pool for high-throughput scenarios
tasks = [atlas.get_events(limit=10) for _ in range(100)]
results = await asyncio.gather(*tasks)

await atlas.close()
```

## Error Handling

All clients include comprehensive error handling:

```python
try:
    events = await atlas.get_events(limit=1000)
except ConnectionError:
    logger.error("Database connection failed")
    return await fallback_data_source()
except ValidationError as e:
    logger.error(f"Data validation failed: {e}")
    return []
```

## Configuration

### Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/realpolitik
NEO4J_URI=bolt://localhost:7687
QDRANT_URI=http://localhost:6333
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
```

### Programmatic Configuration

```python
config = {
    "database_url": "postgresql://...",
    "neo4j_uri": "bolt://...",
    "qdrant_uri": "http://...",
    "redis_url": "redis://...",
    "rabbitmq_url": "amqp://..."
}

atlas = AtlasClient(config["database_url"])
ariadne = AriadneClient(
    uri=config["neo4j_uri"],
    username="neo4j", 
    password="password"
)
```

## Testing

### Mock Clients

```python
from unittest.mock import AsyncMock
from realpolitik_clients import AtlasClient

# Mock database for testing
mock_atlas = AsyncMock(spec=AtlasClient)
mock_atlas.get_events.return_value = [
    {"id": "evt-1", "title": "Test Event", "category": "MILITARY"}
]

# Test service with mock
service = AnalysisService(mock_atlas, ariadne, mnemosyne)
result = await service.analyze_events(["evt-1"])
```

### Test Database

```bash
# Start test databases with Docker
docker-compose -f docker-compose.test.yml up

# Run tests with test database
poetry run pytest tests/integration/
```

## Monitoring

All clients include connection health checks:

```python
# Health checks
if await atlas.test_connection():
    logger.info("Atlas connection healthy")
else:
    logger.error("Atlas connection failed")

if await ariadne.test_connection():
    logger.info("Ariadne connection healthy")  
else:
    logger.error("Ariadne connection failed")
```

## Dependencies

Each client has minimal dependencies:

- **Atlas**: `asyncpg`, `sqlalchemy`
- **Ariadne**: `neo4j`
- **Mnemosyne**: `qdrant-client`  
- **Lethe**: `redis[asyncio]`
- **Iris**: `pika`

## Performance

### Connection Pooling
- Atlas: SQLAlchemy async pool (default 5-20 connections)
- Ariadne: Neo4j driver pool (default 50 connections)
- Lethe: Redis connection pool (default 10 connections)

### Batch Operations
```python
# Batch write operations
await atlas.batch_write_events(events)

# Batch graph operations
await ariadne.batch_create_entities(entities)
```

## Versioning

- **API Compatibility**: All clients maintain backward compatibility
- **Schema Changes**: Database schema changes use migration scripts
- **Client Updates**: New client features are additive only