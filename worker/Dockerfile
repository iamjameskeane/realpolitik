FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY main.py .
COPY ../shared/event_schema.json ./schema/

# Run the worker
CMD ["python", "main.py"]
