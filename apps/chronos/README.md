# Chronos - Change Data Capture Pipeline

**Chronos** is the Change Data Capture (CDC) pipeline service in the Realpolitik distributed intelligence platform. It monitors PostgreSQL outbox events and publishes them to RabbitMQ for fanout to downstream services.

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Argus    │    │   Chronos   │    │   Debezium  │
│   (Python)  │───▶│     (Go)    │───▶│  (Java)    │
└─────────────┘    └─────────────┘    └─────────────┘
                          │                    │
                          ▼                    ▼
                   ┌─────────────┐    ┌─────────────┐
                   │ PostgreSQL  │    │  RabbitMQ   │
                   │   (Atlas)   │◀───│   (Iris)    │
                   └─────────────┘    └─────────────┘
                                     
                     ┌─────────────┐    ┌─────────────┐
                     │    Clio     │    │   Urania    │
                     │  (Neo4j)    │    │  (Qdrant)   │
                     └─────────────┘    └─────────────┘
```

## Features

- **Change Data Capture**: Monitors PostgreSQL WAL for outbox table changes
- **Event Streaming**: Publishes captured events to RabbitMQ exchange
- **Health Monitoring**: Comprehensive health checks for all dependencies
- **Debezium Integration**: Full management of Debezium connectors
- **Operational Excellence**: Metrics, logs, and graceful shutdown
- **Production Ready**: Kubernetes deployment, monitoring, and alerting

## Quick Start

### Prerequisites

- PostgreSQL 15+ with logical replication enabled
- RabbitMQ 3.12+
- Go 1.21+

### Development Setup

1. **Clone and setup**:
```bash
cd apps/chronos
go mod tidy
```

2. **Environment configuration**:
```bash
cp .env.example .env
# Edit .env with your database and RabbitMQ configuration
```

3. **Run the service**:
```bash
go run ./cmd/chronos/main.go
```

4. **Verify health**:
```bash
curl http://localhost:8080/health
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `RABBITMQ_URL` | RabbitMQ connection string | - |
| `DEBEZIUM_SERVER_URL` | Debezium Server URL | `http://localhost:8083` |
| `DEBEZIUM_CONNECTOR_NAME` | Default connector name | `chronos-connector` |
| `SERVICE_PORT` | HTTP service port | `8080` |
| `LOG_LEVEL` | Logging level | `info` |
| `METRICS_ENABLED` | Enable Prometheus metrics | `true` |

### Example Configuration

```bash
# Database
DATABASE_URL=postgresql://realpolitik:realpolitik_password@localhost:5432/realpolitik

# RabbitMQ
RABBITMQ_URL=amqp://realpolitik:realpolitik_password@localhost:5672/

# Debezium
DEBEZIUM_SERVER_URL=http://localhost:8083
DEBEZIUM_CONNECTOR_NAME=chronos-connector

# Service
SERVICE_PORT=8080
LOG_LEVEL=info
METRICS_ENABLED=true
```

## API Endpoints

### Health Checks

- `GET /health` - Overall health status
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Debezium Management

- `POST /connectors` - Create a new connector
- `GET /connectors` - List all connectors
- `GET /connectors/:name/status` - Get connector status
- `PUT /connectors/:name/pause` - Pause a connector
- `PUT /connectors/:name/resume` - Resume a connector
- `POST /connectors/:name/restart` - Restart a connector
- `DELETE /connectors/:name` - Delete a connector

### Monitoring

- `GET /metrics` - Prometheus metrics (if enabled)
- `GET /outbox/health` - Outbox table health
- `GET /outbox/events/pending` - List pending events
- `GET /rabbitmq/health` - RabbitMQ health
- `GET /rabbitmq/topology` - RabbitMQ topology

### Example Usage

#### Create a Debezium Connector

```bash
curl -X POST http://localhost:8080/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "chronos-connector",
    "config": {
      "connector.class": "PostgresConnector",
      "database.hostname": "atlas",
      "database.port": "5432",
      "database.dbname": "realpolitik",
      "database.user": "realpolitik",
      "database.password": "realpolitik_password",
      "slot.name": "chronos_slot",
      "publication.name": "chronos_pub",
      "table.include.list": "public.outbox_events"
    }
  }'
```

#### Check Connector Status

```bash
curl http://localhost:8080/connectors/chronos-connector/status
```

#### Get Outbox Health

```bash
curl http://localhost:8080/outbox/health
```

## Development

### Running Tests

```bash
# Run all tests
go test ./...

# Run with coverage
go test -cover ./...

# Run specific package
go test ./internal/config -v
```

### Building

```bash
# Build binary
go build ./cmd/chronos

# Build for multiple platforms
GOOS=linux GOARCH=amd64 go build -o chronos-linux-amd64 ./cmd/chronos
GOOS=darwin GOARCH=amd64 go build -o chronos-darwin-amd64 ./cmd/chronos
```

### Code Quality

```bash
# Format code
go fmt ./...

# Lint code
go vet ./...

# Check imports
go mod tidy
```

## Docker Deployment

### Build Image

```bash
docker build -f configs/docker/Dockerfile -t realpolitik/chronos:latest .
```

### Run with Docker Compose

See `deployment/docker-compose.yml` for complete setup including PostgreSQL, RabbitMQ, and Debezium.

```bash
cd deployment
docker-compose up -d
```

### Environment Variables

Set the following environment variables in your container:

```yaml
environment:
  - DATABASE_URL=postgresql://realpolitik:password@atlas:5432/realpolitik
  - RABBITMQ_URL=amqp://realpolitik:password@iris:5672/
  - DEBEZIUM_SERVER_URL=http://debezium-server:8083
  - SERVICE_PORT=8080
  - LOG_LEVEL=info
  - METRICS_ENABLED=true
```

## Kubernetes Deployment

### Using Helm

```bash
helm install chronos ./deployment/k8s/helm/chronos \
  --set database.url=postgresql://... \
  --set rabbitmq.url=amqp://... \
  --set debezium.serverUrl=http://...
```

### Manual Deployment

```bash
kubectl apply -f deployment/k8s/chronos.yaml
kubectl apply -f deployment/k8s/debezium.yaml
```

## Monitoring

### Prometheus Metrics

When `METRICS_ENABLED=true`, the service exposes Prometheus metrics at `/metrics`:

- `chronos_events_processed_total` - Total events processed
- `chronos_cdc_lag_seconds` - CDC processing lag
- `chronos_debezium_connector_state` - Debezium connector state

### Health Checks

The service implements Kubernetes health probes:

- **Readiness Probe**: `GET /health/ready`
- **Liveness Probe**: `GET /health/live`

### Logging

Structured JSON logging with the following fields:
- `service`: chronos
- `level`: debug, info, warn, error
- `timestamp`: RFC3339 timestamp
- `request_id`: Unique request identifier
- `component`: Component name (database, debezium, rabbitmq)

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify `DATABASE_URL` is correct
   - Ensure PostgreSQL has logical replication enabled
   - Check network connectivity

2. **RabbitMQ Connection Failed**
   - Verify `RABBITMQ_URL` is correct
   - Check if RabbitMQ is running and accessible
   - Verify credentials and permissions

3. **Debezium Connector Failed**
   - Check Debezium Server logs
   - Verify PostgreSQL replication slot exists
   - Ensure publication is configured correctly

4. **High CDC Lag**
   - Check RabbitMQ queue backlog
   - Monitor downstream consumer health
   - Scale consumer services if needed

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug go run ./cmd/chronos/main.go
```

### Useful Commands

```bash
# Check service status
curl http://localhost:8080/health

# List connectors
curl http://localhost:8080/connectors

# Check outbox health
curl http://localhost:8080/outbox/health

# View Prometheus metrics
curl http://localhost:8080/metrics
```

## Architecture Decisions

### Why Go?

- **Performance**: Low latency for real-time CDC processing
- **Concurrency**: Excellent goroutine and channel support
- **Static Compilation**: Single binary deployment
- **Ecosystem**: Great library support for PostgreSQL, RabbitMQ, and monitoring

### Why Debezium?

- **Battle-Tested**: Used at Netflix, Shopify, and other scale companies
- **Exactly-Once Semantics**: Reliable event processing
- **Wide Database Support**: Supports PostgreSQL, MySQL, MongoDB, etc.
- **Production Ready**: Monitoring, health checks, and operational features

### Why Not Write CDC from Scratch?

- **Complexity**: WAL streaming, replication slots, error handling
- **Risk**: Battle-tested solution vs. custom implementation
- **Maintenance**: Focus on business logic, not infrastructure
- **Skills**: Leverages existing PostgreSQL expertise

## Topic Exchange Configuration

```javascript
// RabbitMQ exchange topology
{
  "exchange": "realpolitik",
  "type": "topic",
  "routing_keys": {
    "event.ingested": "*",           // All events
    "analysis.requested": "analysis.*", // Analysis events
    "analysis.completed": "analysis.*",
    "analysis.invalidated": "analysis.*"
  },
  "bindings": {
    "clio": ["event.ingested"],           // Graph writer
    "urania": ["event.ingested"],         // Vector writer
    "cassandra": ["analysis.requested"]   // Analysis engine
  }
}
```

## Development Commands

```bash
# Run locally (connects to local services)
go run ./cmd/chronos/main.go

# With Debezium connector
docker run -d \
  --name debezium-server \
  -p 8083:8080 \
  debezium/server:latest
```

## Dependencies

- PostgreSQL (Atlas) for WAL monitoring
- RabbitMQ (Iris) for event publishing
- Debezium Server for production CDC
- Prometheus for metrics collection

## Failure Recovery

### Automatic Restart
The service handles failures gracefully with:
- Health checks for all dependencies
- Automatic retry logic for transient failures
- Circuit breaker patterns for resilient operation

### Manual Recovery
```bash
# Restart Debezium connector
curl -X POST http://localhost:8083/connectors/debezium-connector/restart

# Reset CDC position
curl -X PUT http://localhost:8083/connectors/debezium-connector/offsets \
  -H "Content-Type: application/json" \
  -d '{"ts_ms": 1640995200000}'
```

## Contributing

1. Follow Go coding conventions
2. Add tests for new functionality
3. Update documentation
4. Run `go mod tidy` before committing

## License

See the main Realpolitik project license.