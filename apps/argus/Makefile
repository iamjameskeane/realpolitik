.PHONY: help install install-dev test lint format run-local run-prod clean

help:  ## Show this help message
	@echo "Argus - Intelligence Engine for Realpolitik"
	@echo ""
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install:  ## Install production dependencies
	pip install --upgrade pip
	pip install -r requirements.txt

install-dev:  ## Install development dependencies
	pip install --upgrade pip
	pip install -r requirements.txt
	pip install -e ".[dev]"
	pre-commit install

test:  ## Run all tests
	pytest -v

test-graph:  ## Run graph/constellation tests only
	pytest tests/test_graph_*.py tests/test_entity_extraction.py -v

test-cov:  ## Run tests with coverage report
	pytest --cov=. --cov-report=html --cov-report=term

test-graph-cov:  ## Run graph tests with coverage
	pytest tests/test_graph_*.py tests/test_entity_extraction.py --cov=graph --cov=pipeline/graph_processing --cov=enrichment/entities --cov-report=term-missing

lint:  ## Check code quality with ruff
	ruff check .

lint-fix:  ## Fix code quality issues automatically
	ruff check --fix .

format:  ## Format code with ruff
	ruff format .

format-check:  ## Check if code is formatted
	ruff format --check .

run-local:  ## Run pipeline locally (RSS only, local output)
	python main.py --sources rss --output local

run-prod:  ## Run full pipeline (all sources, Supabase output)
	python main.py --sources all --output supabase

clean:  ## Clean up cache and temporary files
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	find . -type d -name "htmlcov" -exec rm -rf {} +
	find . -type f -name ".coverage" -delete

seed-aliases:  ## Seed common entity aliases
	python scripts/seed_aliases.py

backfill:  ## Backfill knowledge graph from existing events
	python scripts/backfill_graph.py

backfill-preview:  ## Preview backfill without making changes
	python scripts/backfill_graph.py --dry-run --limit 5

sync-r2:  ## Sync events from R2 to Supabase + run graph backfill
	python scripts/sync_from_r2.py

sync-r2-preview:  ## Preview R2 sync without making changes
	python scripts/sync_from_r2.py --dry-run

sync-r2-events-only:  ## Sync R2 events without graph backfill
	python scripts/sync_from_r2.py --no-graph

docker-build:  ## Build Docker image
	docker build -t argus:latest .

docker-run:  ## Run Docker container
	docker run --env-file .env argus:latest
