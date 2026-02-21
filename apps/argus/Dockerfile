# Argus Dockerfile - OpenRouter-only RSS Intelligence Engine
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash argus
RUN chown -R argus:argus /app
USER argus

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import sys; sys.path.insert(0, '/app'); from config import Config; config = Config.from_env(); config.validate(); print('OK')" || exit 1

# Default command
CMD ["python", "main.py", "--sources", "rss", "--output", "supabase"]