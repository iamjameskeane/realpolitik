# Styx Gateway

**Gateway to the underworld** - The API gateway for Realpolitik's Olympian services.

Styx is the unified entry point for all external traffic to the Realpolitik distributed intelligence platform. Built with Go and following an MVP incremental approach, it provides routing, health checking, and foundation for future security and performance features.

## Overview

Styx serves as the **single entry point** for the Realpolitik platform:

```
External Clients → Styx Gateway → Olympian Services
                    │
         ┌──────────┼──────────┐
         │          │          │
      Delphi    Hermes    Pythia
    (App API)  (MCP API)  (WebSocket)
         │          │          │
    Atlas/Neo4j  Qdrant/Redis  Database
```

## Core Features

### MVP (Current Implementation)
- **Smart Routing**: Routes requests to appropriate services
  - `/api/*` → Delphi (HTTP API)
  - `/mcp/*` → Hermes (MCP Protocol)
  - `/ws/*` → Pythia (WebSocket)
- **Health Monitoring**: `/health` and `/health/ready` endpoints
- **Service Discovery**: Environment-based backend configuration
- **Structured Logging**: Structured logs with request context
- **Graceful Shutdown**: Proper cleanup on termination

### Phase 2 (Planned)
- **JWT Authentication**: Token validation and authorization
- **Rate Limiting**: Redis-backed sliding window rate limiting
- **SSL/TLS Termination**: Let's Encrypt integration
- **Circuit Breaker**: Service failure handling

### Phase 3 (Future)
- **Request Caching**: Edge caching for static responses
- **Load Balancing**: Advanced algorithms and health-based routing
- **Monitoring**: OpenTelemetry integration
- **WAF Protection**: Security rules and threat detection

## Quick Start

### Local Development

1. **Build the gateway**:
   ```bash
   cd apps/styx
   go build -o styx cmd/main.go
   ```

2. **Set environment variables**:
   ```bash
   export DELPHI_URL=http://localhost:8000
   export HERMES_URL=http://localhost:8002
   export PYTHIA_URL=http://localhost:8001
   export PORT=8080
   ```

3. **Run the gateway**:
   ```bash
   ./styx
   ```

4. **Test the endpoints**:
   ```bash
   curl http://localhost:8080/health
   curl http://localhost:8080/
   ```

### Docker Deployment

1. **Build the image**:
   ```bash
   cd apps/styx
   ./scripts/build.sh 0.1.0
   ```

2. **Run with Docker**:
   ```bash
   docker run -p 8080:8080 \
     -e DELPHI_URL=http://host.docker.internal:8000 \
     -e HERMES_URL=http://host.docker.internal:8002 \
     -e PYTHIA_URL=http://host.docker.internal:8001 \
     realpolitik/styx:0.1.0
   ```

### Kubernetes Deployment

1. **Apply the manifests**:
   ```bash
   kubectl apply -f deployments/k8s/styx-deployment.yaml
   kubectl apply -f deployments/k8s/styx-config.yaml
   ```

2. **Apply ingress configuration**:
   ```bash
   kubectl apply -f deployments/k8s/styx-ingress.yaml
   ```

3. **Check deployment**:
   ```bash
   kubectl get pods -n realpolitik-services -l app=styx
   kubectl logs -f deployment/styx -n realpolitik-services
   ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Gateway listen port |
| `DELPHI_URL` | `http://delphi:8000` | Delphi service URL |
| `HERMES_URL` | `http://hermes:8002` | Hermes service URL |
| `PYTHIA_URL` | `http://pythia:8001` | Pythia service URL |
| `HEALTH_CHECK_INTERVAL` | `30s` | Health check frequency |
| `HEALTH_CHECK_TIMEOUT` | `5s` | Health check timeout |
| `RATE_LIMIT_ENABLED` | `false` | Enable rate limiting |
| `RATE_LIMIT_RPS` | `100` | Rate limit per second |
| `JWT_ENABLED` | `false` | Enable JWT authentication |
| `JWT_SECRET` | `` | JWT signing secret |
| `REDIS_URL` | `redis://lethe:6379` | Redis for caching/rate limiting |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |

## API Endpoints

### Gateway Endpoints
- `GET /` - Gateway status and routing information
- `GET /health` - Detailed health status
- `GET /health/ready` - Readiness check

### Routed Endpoints
- `GET/POST /api/*` → Delphi API
- `GET/POST /mcp/*` → Hermes MCP Server  
- `GET/POST /ws/*` → Pythia WebSocket Server

## Integration with Realpolitik

### Development Setup
Add Styx to your local Realpolitik setup:

1. **Update docker-compose.yml**:
   ```yaml
   services:
     styx:
       build:
         context: ./apps/styx
         dockerfile: Dockerfile
       ports:
         - "8080:8080"
       environment:
         - DELPHI_URL=http://delphi:8000
         - HERMES_URL=http://hermes:8002
         - PYTHIA_URL=http://pythia:8001
         - REDIS_URL=redis://lethe:6379
       depends_on:
         - delphi
         - hermes  
         - pythia
       labels:
         - "traefik.enable=true"
         - "traefik.http.routers.styx.rule=Host(`localhost`)"
   ```

### Migration Strategy
1. **Parallel Operation**: Run Styx alongside existing Traefik
2. **Gradual Migration**: Route specific paths to Styx first
3. **Validation**: Test routing and health checks
4. **Full Cutover**: Replace original Traefik when confident

## Monitoring

### Health Checks
- **Liveness**: `/health` - Is the gateway running?
- **Readiness**: `/health/ready` - Are backends available?

### Metrics (Future)
- Request counts by route
- Response times and latency
- Backend health status
- Error rates by service

### Logging
Structured JSON logs with context:
```json
{
  "timestamp": "2024-02-21T10:30:00Z",
  "level": "info",
  "service": "styx",
  "component": "gateway",
  "message": "routing to delphi",
  "method": "GET",
  "path": "/api/v1/events",
  "status_code": 200,
  "duration_ms": 45
}
```

## Security

### Current (MVP)
- No authentication (for development)
- HTTP only (SSL in Phase 2)
- Basic request routing

### Planned Security Features
- JWT token validation
- Rate limiting per user/IP
- SSL/TLS termination
- Request sanitization
- Circuit breaker patterns

## Troubleshooting

### Common Issues

1. **Gateway won't start**:
   ```bash
   # Check environment variables
   env | grep -E "(DELPHI|HERMES|PYTHIA)_URL"
   
   # Check port availability
   netstat -an | grep 8080
   ```

2. **Routing not working**:
   ```bash
   # Check backend services
   curl http://delphi:8000/health
   curl http://hermes:8002/health
   curl http://pythia:8001/health
   ```

3. **Health checks failing**:
   ```bash
   # Check gateway logs
   kubectl logs deployment/styx -n realpolitik-services
   
   # Manual health check
   curl http://localhost:8080/health
   ```

## Development

### Code Structure
```
styx/
├── cmd/main.go              # Application entry point
├── internal/
│   ├── config/             # Configuration management
│   ├── gateway/            # Core routing logic
│   ├── health/             # Health checking
│   └── logging/            # Structured logging
├── pkg/discovery/          # Service discovery
├── deployments/            # Deployment configurations
├── docs/                   # Documentation and reports
├── scripts/                # Build and demo scripts
├── Dockerfile             # Container image
└── README.md              # This file
```

### Adding New Routes
1. Update `gateway.go` `setupRoutes()` method
2. Add proxy handler function
3. Test with curl or browser
4. Update this README

### Running Tests
```bash
cd apps/styx
go test ./...
go test -race ./...  # With race detection
```

## Contributing

1. Follow the **Olympian naming** convention
2. Maintain MVP approach - add features incrementally  
3. Add health checks for new functionality
4. Include structured logging for operations
5. Update documentation for new routes/config

## License

MIT License - See LICENSE file for details.