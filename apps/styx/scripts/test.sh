#!/bin/bash

# Styx Gateway Test Runner

set -e

echo "🧪 Running Styx Gateway Tests"

# Change to styx directory  
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Run all tests
echo "Running unit tests..."
go test ./... -v -race

# Run linting if available
if command -v gofmt >/dev/null 2>&1; then
    echo "Running gofmt..."
    if [ -n "$(gofmt -l .)" ]; then
        echo "Files need formatting:"
        gofmt -l .
        exit 1
    else
        echo "✓ Code formatting is correct"
    fi
fi

# Run vet
echo "Running go vet..."
go vet ./...

# Generate coverage report
echo "Generating test coverage report..."
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

echo "✅ All tests passed!"
echo "📊 Coverage report: coverage.html"