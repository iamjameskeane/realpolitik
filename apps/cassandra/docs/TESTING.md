# Cassandra Testing Suite

Comprehensive testing suite for the Cassandra microservice and its integration with the Delphi API.

## 🧪 Test Structure

```
tests/
├── __init__.py                 # Test configuration and fixtures
├── test_analysis_engine.py     # Unit tests for analysis engine
├── test_consumer.py           # Unit tests for message consumer
└── test_delphi_integration.py # Integration tests for Delphi-Cassandra flow
```

## 🚀 Running Tests

### Quick Start
```bash
# Install dependencies
cd apps/cassandra && poetry install

# Run all tests
make test

# Run with coverage
make test-coverage
```

### Detailed Test Commands
```bash
# Unit tests only
make test-unit

# Integration tests only
make test-integration

# Run specific test file
make test-file FILE=test_analysis_engine.py

# Run with verbose output
poetry run pytest tests/ -v --tb=long

# Run with markers
poetry run pytest tests/ -m "integration"  # Only integration tests
poetry run pytest tests/ -m "not slow"     # Skip slow tests
```

## 📊 Test Categories

### Unit Tests
- **test_analysis_engine.py**: Core analysis functionality
- **test_consumer.py**: Message queue consumer logic

### Integration Tests
- **test_delphi_integration.py**: End-to-end Delphi ↔ Cassandra communication

## 🔍 Test Coverage

### Analysis Engine Tests
- ✅ Event context assembly
- ✅ Graph database queries (Neo4j, Qdrant)
- ✅ AI synthesis with OpenRouter
- ✅ Cache operations (Redis)
- ✅ Error handling and retry logic

### Consumer Tests
- ✅ Message queue connection (Iris/RabbitMQ)
- ✅ Message parsing and validation
- ✅ Analysis request processing
- ✅ Response handling
- ✅ Graceful shutdown

### Integration Tests
- ✅ Delphi API message format compatibility
- ✅ Complete message flow simulation
- ✅ Error scenarios and recovery
- ✅ Performance requirements validation

## 🛠 Test Fixtures

### Available Fixtures
- `sample_analysis_request`: Standard analysis request
- `sample_analysis_response`: Expected analysis response
- `mock_database_queries`: Database interaction mocks
- `mock_ai_client`: AI service client mock
- `mock_cache`: Redis cache client mock

### Configuration Testing
```bash
# Validate configuration
make check-config
```

## 📈 Coverage Reports

Generate and view coverage reports:
```bash
# Generate HTML coverage report
make test-coverage

# View coverage in terminal
poetry run pytest tests/ --cov=src --cov-report=term
```

## 🔧 Continuous Integration

### Pre-commit Hooks
```bash
# Format code before committing
make format

# Lint code
make lint
```

### Docker Testing
```bash
# Build and test in Docker
docker build -t realpolitik/cassandra:test .
docker run -it realpolitik/cassandra:test poetry run pytest tests/
```

## 🎯 Integration Testing

### Delphi API Integration
Tests validate that:
1. Delphi sends properly formatted messages to `analysis.requested` queue
2. Cassandra correctly receives and processes these messages
3. Analysis results are properly formatted and cached
4. Error handling works for invalid messages or processing failures

### Message Flow Validation
```python
# Test validates this exact flow:
User Request → Delphi API → RabbitMQ (analysis.requested) 
           → Cassandra Consumer → Analysis Engine → Results Cache
```

## 🐛 Debugging Tests

### Verbose Output
```bash
# Detailed test execution
poetry run pytest tests/ -v -s --tb=long
```

### Selective Test Running
```bash
# Run specific test method
poetry run pytest tests/test_consumer.py::test_message_processing -v

# Run tests matching pattern
poetry run pytest tests/ -k "consumer" -v
```

### Mock Configuration
Tests use comprehensive mocking to avoid external dependencies:
- ✅ Database connections (PostgreSQL, Neo4j, Qdrant)
- ✅ Redis cache
- ✅ RabbitMQ message queue
- ✅ AI service (OpenRouter)

## 📋 Test Configuration

### pytest.ini
The `pytest.ini` file configures:
- Test discovery patterns
- Async test handling
- Output formatting
- Custom markers

### Environment Variables
Tests use mocked environment variables via fixtures, no `.env` file required for testing.

## 🚨 Test Failures

### Common Issues
1. **Import Errors**: Ensure Poetry dependencies are installed
2. **Async Issues**: Tests require `pytest-asyncio` plugin
3. **Mock Configuration**: Check fixture definitions in `__init__.py`

### Troubleshooting
```bash
# Clean and reinstall
make clean
poetry install

# Run single test for debugging
poetry run pytest tests/test_consumer.py::test_consumer_initialization -v -s
```

## ✅ Success Criteria

All tests must pass for Cassandra to be considered production-ready:
- Unit test coverage > 80%
- Integration tests validate complete message flow
- Error scenarios properly handled
- Performance requirements met

Run `make test` to verify all criteria are met.