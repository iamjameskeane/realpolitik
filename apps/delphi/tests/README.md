# Delphi Testing Suite

Comprehensive testing suite for the Delphi API server.

## Test Structure

```
tests/
├── conftest.py                 # Test fixtures and configuration
├── unit/                       # Unit tests
│   ├── test_config.py         # Configuration tests
│   ├── test_auth.py           # Authentication tests
│   ├── test_rate_limiting.py  # Rate limiting tests
│   ├── test_query_routing.py  # Query routing tests
│   ├── test_schemas.py        # Schema library tests
│   └── test_client_library.py # Database client tests
├── integration/               # Integration tests
│   └── test_api_endpoints.py  # API endpoint tests
└── fixtures/                  # Test data and fixtures
```

## Running Tests

### Run All Tests
```bash
cd apps/delphi
poetry run pytest
```

### Run Unit Tests Only
```bash
poetry run pytest tests/unit/ -v
```

### Run Integration Tests Only
```bash
poetry run pytest tests/integration/ -v
```

### Run Specific Test
```bash
poetry run pytest tests/unit/test_config.py::test_settings_default_values -v
```

### Run with Coverage
```bash
poetry run pytest --cov=src --cov-report=html
```

### Run with Markers
```bash
# Run only async tests
poetry run pytest -m asyncio

# Run only fast tests
poetry run pytest -m "not slow"
```

## Test Categories

### Unit Tests
- **Configuration**: Environment variables, validation, defaults
- **Authentication**: JWT validation, permission checking, user management
- **Rate Limiting**: Redis-backed sliding window algorithm
- **Query Routing**: Intelligent data store routing logic
- **Schemas**: Data model validation and serialization
- **Clients**: Database client unit testing

### Integration Tests
- **API Endpoints**: Full HTTP request/response testing
- **Health Checks**: Service health monitoring
- **CORS**: Cross-origin request handling
- **Error Handling**: 404s, validation errors, etc.

## Test Fixtures

### Mock Users
- `mock_user`: Standard analyst user
- `mock_admin_user`: Admin user with elevated permissions

### Mock Data
- `mock_events`: Sample geopolitical events
- `test_env_vars`: Environment variable configuration

### Mock Clients
- `mock_atlas_client`: Mock PostgreSQL client
- `mock_lethe_client`: Mock Redis client
- `mock_iris_client`: Mock RabbitMQ client

## Development Guidelines

### Writing Tests
1. Use descriptive test names that explain the scenario
2. Mock external dependencies (databases, Redis, etc.)
3. Test both success and failure cases
4. Use fixtures for common setup
5. Follow the AAA pattern: Arrange, Act, Assert

### Test Coverage Goals
- **Core Logic**: 90%+ coverage for business logic
- **API Endpoints**: 100% coverage for all endpoints
- **Error Handling**: Test all error conditions
- **Authentication**: Test all auth flows

### Mocking Best Practices
- Mock at the appropriate level (unit vs integration)
- Use specific assertions to verify correct behavior
- Ensure mocks match real interfaces
- Clean up mocks after each test

## Continuous Integration

Tests are designed to run in CI/CD with:
- No external dependencies
- Fast execution (under 30 seconds)
- Deterministic results
- Clear pass/fail indicators

## Test Data

Test data should be:
- **Realistic**: Reflect actual production scenarios
- **Minimal**: Only what's needed for the test
- **Isolated**: No dependency between tests
- **Repeatable**: Same results every time

## Debugging Tests

### Verbose Output
```bash
poetry run pytest tests/unit/test_config.py -v -s
```

### Debug Mode
```bash
poetry run pytest tests/unit/test_config.py --pdb
```

### Show Local Variables
```bash
poetry run pytest tests/unit/test_config.py -l
```

## Performance Testing

For performance-sensitive code:
- Use `pytest-benchmark` for timing
- Test with realistic data volumes
- Monitor memory usage
- Profile slow operations

## Security Testing

- Test authentication failures
- Verify authorization boundaries
- Test input validation
- Check for injection vulnerabilities