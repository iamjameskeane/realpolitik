# Realpolitik Schema Library

**Canonical data models** for the distributed intelligence platform.

## Overview

This library defines the **canonical schemas** used across all Realpolitik services. These schemas ensure data consistency and provide type safety throughout the distributed system.

## Data Models

### Events
- `GeopoliticalEvent`: Core event representation
- `EventSource`: News source with metadata
- `EventSeverity`: Severity levels (LOW, MEDIUM, HIGH, CRITICAL)
- `EventCategory`: Event categories (MILITARY, DIPLOMATIC, ECONOMIC, SOCIAL)

### Analysis
- `FalloutAnalysis`: AI-generated impact assessment
- `AnalysisRequest`: Request for fallout analysis
- `AnalysisStatus`: Processing states (PENDING, PROCESSING, COMPLETED, FAILED, CACHED)

### Entities
- `Entity`: Knowledge graph entity representation
- `EntityType`: Entity classifications (country, organization, person, etc.)
- `Relationship`: Entity-to-entity relationships
- `EntityMention`: Event-entity associations

### Messages
- `EventIngested`: Outbox event for CDC
- `AnalysisRequested`: Analysis request message
- `AnalysisCompleted`: Analysis result message
- `EventIngestFailed`: Ingestion failure notification

## Usage

```python
from realpolitik_schema import GeopoliticalEvent, EventSeverity, EventCategory

# Create event
event = GeopoliticalEvent(
    title="Military Escalation in Eastern Ukraine",
    summary="Russian forces increased military activity",
    category=EventCategory.MILITARY,
    severity=EventSeverity.HIGH,
    occurred_at=datetime.utcnow(),
    primary_location="Donbas, Ukraine",
    coordinates={"latitude": 48.0159, "longitude": 37.8024},
    sources=[...]
)
```

## Serialization

All models support JSON serialization:

```python
# To JSON
event_json = event.model_dump_json()

# From JSON
event = GeopoliticalEvent.model_validate_json(event_json)
```

## Validation

Models include comprehensive validation:

```python
# Automatic validation
try:
    event = GeopoliticalEvent(
        severity=15  # Invalid: must be 1-10
    )
except ValidationError as e:
    print(e)
```

## Integration

Services import from this library:

```python
# In Argus
from realpolitik_schema import GeopoliticalEvent, EventIngested

# In Cassandra  
from realpolitik_schema import FalloutAnalysis, AnalysisCompleted

# In Delphi
from realpolitik_schema import GeopoliticalEvent, AnalysisRequest
```

## Migration Compatibility

This schema library maintains compatibility with:

- **Atlas Foundation Schema**: PostgreSQL event storage
- **Neo4j Graph Model**: Entity and relationship structures
- **Qdrant Vector Schema**: Embedding metadata
- **RabbitMQ Messages**: Inter-service communication

## Testing

```bash
cd libs/realpolitik-schema
poetry run pytest
```

## Publishing

```bash
poetry build
poetry publish
```

## Versioning

- **Major**: Breaking changes to data models
- **Minor**: New fields, backward compatible
- **Patch**: Bug fixes, documentation

Current version: `1.0.0`