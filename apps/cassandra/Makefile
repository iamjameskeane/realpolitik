# Makefile for Cassandra testing and development

.PHONY: test test-unit test-integration test-all install clean lint format

# Install dependencies
install:
	poetry install

# Run all tests
test:
	poetry run pytest tests/ -v

# Run unit tests only
test-unit:
	poetry run pytest tests/ -v -m "not integration"

# Run integration tests only
test-integration:
	poetry run pytest tests/test_delphi_integration.py -v

# Run tests with coverage
test-coverage:
	poetry run pytest tests/ --cov=src --cov-report=html --cov-report=term

# Run specific test file
test-file:
	poetry run pytest tests/$(FILE) -v

# Lint code
lint:
	poetry run flake8 src/ tests/
	poetry run mypy src/

# Format code
format:
	poetry run black src/ tests/
	poetry run isort src/ tests/

# Clean build artifacts
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Run Cassandra service locally
dev:
	poetry run python -m src.main

# Build Docker image
docker-build:
	docker build -t realpolitik/cassandra:latest .

# Check configuration
check-config:
	poetry run python -c "from src.config import Config; c = Config.from_env(); c.validate(); print('✅ Configuration valid')"