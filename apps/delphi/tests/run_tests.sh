#!/bin/bash

# Delphi Test Runner Script

echo "🧪 Running Delphi Test Suite"
echo "=============================="

# Run unit tests
echo "📋 Running Unit Tests..."
poetry run pytest tests/unit/ -v --tb=short

echo ""
echo "🔗 Running Integration Tests..."
poetry run pytest tests/integration/ -v --tb=short

echo ""
echo "📊 Running Tests with Coverage..."
poetry run pytest --cov=src --cov-report=term-missing --cov-report=html

echo ""
echo "✅ All tests completed!"