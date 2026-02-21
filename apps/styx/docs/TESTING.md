# Styx Testing Suite

## Test Structure

The Styx gateway includes a comprehensive testing suite with:

### Unit Tests
- **Gateway functionality**: Route handling, health checks, configuration
- **Configuration loading**: Environment variable parsing and defaults
- **Health checking**: Service health monitoring and status reporting

### Test Organization
```
tests/
├── styx_test.go      # Main test suite with gateway and config tests
└── test.sh           # Test runner script
```

## Running Tests

### Individual Test Commands
```bash
# Run all tests
go test ./... -v

# Run with race detection
go test ./... -race

# Generate coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html
```

### Using the Test Script
```bash
./test.sh
```

This runs:
- All unit tests with race detection
- Code formatting check (gofmt)
- Static analysis (go vet)  
- Coverage report generation

## Test Coverage

Current test coverage includes:
- ✅ Gateway creation and configuration
- ✅ Health endpoints (/health, /health/ready)
- ✅ Root endpoint with status information
- ✅ Configuration loading from environment
- ✅ Default value handling
- ✅ Service routing setup

## Example Test Output
```
=== RUN   TestNewGateway
--- PASS: TestNewGateway (0.00s)
=== RUN   TestGatewayRootHandler
--- PASS: TestGatewayRootHandler (0.00s)
=== RUN   TestGatewayHealthHandler
--- PASS: TestGatewayHealthHandler (0.00s)
=== RUN   TestGatewayReadinessHandler
--- PASS: TestGatewayReadinessHandler (0.00s)
=== RUN   TestConfig
--- PASS: TestConfig (0.00s)
=== RUN   TestConfigLoad
--- PASS: TestConfigLoad (0.00s)
PASS
```

## Test Development

### Adding New Tests
1. Add test functions to `tests/styx_test.go`
2. Use `require` for fatal assertions, `assert` for non-fatal
3. Mock external dependencies using `httptest`
4. Follow naming convention: `TestComponentBehavior`

### Test Helpers
Available test utilities:
- `httptest.NewRequest()` - Create test HTTP requests
- `httptest.NewRecorder()` - Capture HTTP responses  
- `json.Unmarshal()` - Parse JSON responses for assertions

## Continuous Integration

The test suite is designed for CI/CD:
- Fast execution (< 1 second for unit tests)
- No external dependencies required
- Comprehensive coverage of core functionality
- Race condition detection
- Static analysis integration

### CI Pipeline Example
```yaml
- name: Run Styx Tests
  run: |
    cd apps/styx
    ./test.sh
    # Upload coverage report
    - name: Upload Coverage
      uses: codecov/codecov-action@v1
      with:
        file: ./apps/styx/coverage.out
```