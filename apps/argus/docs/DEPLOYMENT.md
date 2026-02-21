# Argus Deployment Guide

Argus is an OpenRouter-powered RSS intelligence engine that can run independently or as part of the Realpolitik ecosystem.

## Quick Start

### 1. Local Development

```bash
# Clone and setup
git clone <repository>
cd argus

# Install dependencies
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your OpenRouter API key

# Test configuration
python -c "from config import Config; Config.from_env().validate()"

# Run once
python main.py --sources rss --output local
```

### 2. Docker Development

```bash
# Start complete development environment
./docker-run.sh dev

# Or start with external databases
./docker-run.sh cron .env.production
```

### 3. Production Deployment

#### Option A: Docker Compose (Recommended)

```bash
# 1. Configure environment
cp .env.example .env
# Edit with your production values

# 2. Start production stack
./docker-run.sh full .env

# 3. Monitor logs
./docker-run.sh logs
```

#### Option B: Kubernetes CronJob

See `k8s/cronjob.yaml` for Kubernetes deployment configuration.

#### Option C: System Cron

```bash
# Add to crontab
*/15 * * * * cd /path/to/argus && /path/to/venv/bin/python main.py --sources rss --output supabase >> /var/log/argus.log 2>&1
```

## Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API key | `sk-or-...` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `NEO4J_URI` | Neo4j graph database | `bolt://neo4j:7687` |
| `QDRANT_URI` | Qdrant vector database | `http://qdrant:6333` |
| `REDIS_URL` | Redis cache | `redis://redis:6379` |
| `RABBITMQ_URL` | RabbitMQ message bus | `amqp://user:pass@rabbitmq:5672` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |

### Optional Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_ENRICHMENT` | `anthropic/claude-3-haiku` | Model for article enrichment |
| `MODEL_SYNTHESIS` | `anthropic/claude-3-sonnet` | Model for event synthesis |
| `MAX_CONCURRENT_REQUESTS` | `5` | Concurrent OpenRouter requests |
| `STORAGE_MODE` | `supabase` | Output mode: `supabase` or `local` |
| `ENABLE_ENTITIES` | `true` | Enable entity extraction |
| `ENABLE_EMBEDDINGS` | `true` | Enable embedding generation |
| `ENABLE_GRAPH_STORAGE` | `true` | Enable graph database storage |

## Database Setup

### PostgreSQL (Atlas)

```sql
-- Create database and user
CREATE DATABASE realpolitik;
CREATE USER argus WITH ENCRYPTED PASSWORD 'argus_password';
GRANT ALL PRIVILEGES ON DATABASE realpolitik TO argus;

-- Connect to database and create tables
\c realpolitik;
-- Run migration scripts from the migrations directory
```

### Neo4j (Ariadne)

```bash
# Set Neo4j password
export NEO4J_AUTH=neo4j/your_password

# Install APOC plugin (for advanced graph operations)
# Add to neo4j.conf:
# dbms.security.procedures.unrestricted=apoc.*
```

### Qdrant (Mnemosyne)

```bash
# Start Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Create collection for events
curl -X PUT "http://localhost:6333/collections/events" \
  -H "Content-Type: application/json" \
  -d '{"vectors": {"size": 1536, "distance": "Cosine"}}'
```

### Redis (Lethe)

```bash
# Start Redis
docker run -p 6379:6379 redis:7-alpine

# Optional: Enable persistence
docker run -p 6379:6379 -v redis_data:/data redis:7-alpine redis-server --appendonly yes
```

### RabbitMQ (Iris)

```bash
# Start RabbitMQ with management interface
docker run -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=argus \
  -e RABBITMQ_DEFAULT_PASS=argus_password \
  rabbitmq:3.12-management
```

## Monitoring

### Health Checks

```bash
# Test configuration
python -c "from config import Config; Config.from_env().validate()"

# Test database connections
python -c "
import asyncio
from config import Config
from enrichment.ai_client import AIClient

async def test():
    config = Config.from_env()
    config.validate()
    client = AIClient(config)
    await client.check_quota()
    print('✅ All connections healthy')

asyncio.run(test())
"
```

### Logs

```bash
# Docker logs
docker-compose logs -f argus

# System cron logs
tail -f /var/log/argus.log

# Application logs
python main.py --sources rss --output supabase 2>&1 | tee argus-$(date +%Y%m%d).log
```

### Metrics

Monitor these metrics:
- OpenRouter API usage and costs
- Database connection health
- Processing time per cycle
- Articles processed per cycle
- Error rates and types

## Troubleshooting

### Common Issues

1. **OpenRouter API Errors**
   ```
   Error: OpenRouter API key invalid
   ```
   - Verify `OPENROUTER_API_KEY` is correct
   - Check OpenRouter dashboard for quota/billing

2. **Database Connection Errors**
   ```
   Error: Connection refused
   ```
   - Verify database services are running
   - Check connection strings and credentials
   - Ensure network connectivity

3. **Memory Issues**
   ```
   Error: Out of memory
   ```
   - Reduce `MAX_CONCURRENT_REQUESTS`
   - Increase container memory limits
   - Process fewer articles per cycle

4. **Graph Storage Errors**
   ```
   Error: Neo4j connection failed
   ```
   - Verify Neo4j is running and accessible
   - Check Neo4j authentication
   - Ensure APOC plugin is installed

### Debug Mode

```bash
# Run with verbose logging
export LOG_LEVEL=DEBUG
python main.py --sources rss --output supabase

# Test individual components
python -c "
from pipeline.processing import fetch_hybrid_articles
import asyncio
articles = asyncio.run(fetch_hybrid_articles([], 'rss'))
print(f'Fetched {len(articles)} articles')
"
```

## Production Considerations

### Security

- Use environment variables for all secrets
- Enable SSL/TLS for database connections
- Restrict database user permissions
- Use read-only database accounts where possible

### Scalability

- Horizontal scaling: Run multiple Argus instances
- Vertical scaling: Increase container resources
- Database optimization: Indexes and query optimization
- Caching: Use Redis for deduplication

### Backup Strategy

- Database backups (PostgreSQL, Neo4j)
- Redis persistence configuration
- Supabase automatic backups
- Configuration backup

### Monitoring & Alerting

- Set up alerts for:
  - OpenRouter API quota usage
  - Database connection failures
  - Processing errors
  - High latency

### Cost Optimization

- Monitor OpenRouter usage and costs
- Adjust `MAX_CONCURRENT_REQUESTS` based on needs
- Use appropriate model tiers
- Implement article filtering to reduce API calls

## Support

For issues and support:
1. Check the logs first
2. Verify configuration
3. Test database connections
4. Review OpenRouter API status
5. Create an issue with logs and configuration details