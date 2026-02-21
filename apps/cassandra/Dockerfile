"""
Cassandra microservice Dockerfile.
"""

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Copy Poetry configuration
COPY pyproject.toml poetry.lock ./

# Install Python dependencies
RUN poetry install --no-dev

# Copy application code
COPY src/ ./src/

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose metrics port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD poetry run python -c "import requests; requests.get('http://localhost:8080/health', timeout=5)"

# Run the service
CMD ["poetry", "run", "python", "-m", "cassandra.main"]