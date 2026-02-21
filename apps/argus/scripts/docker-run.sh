#!/bin/bash

# Argus Docker Deployment Script
# Usage: ./docker-run.sh [full|cron|dev]

set -e

MODE=${1:-full}
ENV_FILE=${2:-.env}

echo "🚀 Starting Argus Intelligence Engine in $MODE mode..."

case $MODE in
  "full")
    echo "📦 Starting complete stack with databases..."
    docker-compose --env-file $ENV_FILE up --build -d
    echo "✅ Complete stack started!"
    echo "📊 Services available:"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Neo4j: localhost:7474 (neo4j/neo4j_password)"
    echo "  - Qdrant: localhost:6333"
    echo "  - Redis: localhost:6379"
    echo "  - RabbitMQ: localhost:15672 (argus/argus_password)"
    echo "  - Argus: Running as cron job (check logs with 'docker-compose logs -f argus')"
    ;;
  
  "cron")
    echo "⏰ Starting Argus as cron job only..."
    docker-compose --env-file $ENV_FILE -f docker-compose.cron.yml up --build -d
    echo "✅ Argus cron job started!"
    echo "📊 Monitor logs: docker-compose -f docker-compose.cron.yml logs -f argus-cron"
    ;;
  
  "dev")
    echo "🔧 Starting development environment..."
    docker-compose --env-file $ENV_FILE up --build
    echo "✅ Development environment started!"
    ;;
  
  "stop")
    echo "🛑 Stopping all services..."
    docker-compose --env-file $ENV_FILE down
    docker-compose --env-file $ENV_FILE -f docker-compose.cron.yml down 2>/dev/null || true
    echo "✅ All services stopped!"
    ;;
  
  "logs")
    echo "📋 Following logs..."
    docker-compose --env-file $ENV_FILE logs -f argus
    ;;
  
  "clean")
    echo "🧹 Cleaning up containers and volumes..."
    docker-compose --env-file $ENV_FILE down -v --remove-orphans
    docker system prune -f
    echo "✅ Cleanup complete!"
    ;;
  
  *)
    echo "❌ Unknown mode: $MODE"
    echo "Usage: $0 [full|cron|dev|stop|logs|clean] [env-file]"
    echo ""
    echo "Modes:"
    echo "  full  - Complete stack with databases (default)"
    echo "  cron  - Only Argus cron job (connects to external DBs)"
    echo "  dev   - Development mode (foreground)"
    echo "  stop  - Stop all services"
    echo "  logs  - Follow Argus logs"
    echo "  clean - Remove all containers and volumes"
    exit 1
    ;;
esac

echo ""
echo "🔧 Useful commands:"
echo "  View status: docker-compose --env-file $ENV_FILE ps"
echo "  View logs: docker-compose --env-file $ENV_FILE logs -f"
echo "  Shell into container: docker-compose --env-file $ENV_FILE exec argus bash"
echo "  Stop services: $0 stop"