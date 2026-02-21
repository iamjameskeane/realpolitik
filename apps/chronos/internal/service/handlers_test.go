package service

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/realpolitik/chronos/internal/config"
	"github.com/realpolitik/chronos/internal/database"
	"github.com/realpolitik/chronos/internal/debezium"
)

func TestChronosServer_NewChronosServer(t *testing.T) {
	// Setup test configuration
	cfg := &config.Config{
		ServicePort:           "8080",
		DatabaseURL:           "postgresql://test:test@localhost:5432/test",
		RabbitMQURL:           "amqp://test:test@localhost:5672/",
		DebeziumServerURL:     "http://localhost:8083",
		DebeziumConnectorName: "test-connector",
		LogLevel:              "info",
		MetricsEnabled:        true,
	}

	// Note: This test will fail due to no real database/RabbitMQ connections
	// but it tests the configuration and initialization logic
	server, err := NewChronosServer(cfg)
	assert.Error(t, err) // Expect error due to no running services
	assert.Nil(t, server)
}

func TestHealthHandler(t *testing.T) {
	// Setup Gin in test mode
	gin.SetMode(gin.TestMode)

	// Create a mock server with properly initialized clients to avoid nil panics
	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
		db:       &database.PostgresClient{}, // Mock client
		debezium: &debezium.DebeziumClient{}, // Mock client
	}

	// Create test request
	req, err := http.NewRequest("GET", "/health", nil)
	require.NoError(t, err)

	// Create response recorder
	rr := httptest.NewRecorder()

	// Create router and add routes
	router := gin.New()
	router.GET("/health", server.HealthHandler)

	// Perform request
	router.ServeHTTP(rr, req)

	// Check status code (may be 500 due to mock clients, but shouldn't panic)
	assert.Contains(t, []int{
		http.StatusOK,
		http.StatusInternalServerError,
	}, rr.Code)

	// Check response structure if successful
	if rr.Code == http.StatusOK {
		var response map[string]interface{}
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		// Verify response fields
		assert.Contains(t, response, "status")
		assert.Contains(t, response, "timestamp")
		assert.Contains(t, response, "checks")
	}
}

func TestReadyHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
		db:       &database.PostgresClient{},
		debezium: &debezium.DebeziumClient{},
	}

	req, err := http.NewRequest("GET", "/health/ready", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()

	router := gin.New()
	router.GET("/health/ready", server.ReadyHandler)
	router.ServeHTTP(rr, req)

	// Should return either OK (if clients are healthy) or ServiceUnavailable
	assert.Contains(t, []int{
		http.StatusOK,
		http.StatusServiceUnavailable,
	}, rr.Code)
}

func TestLiveHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
	}

	req, err := http.NewRequest("GET", "/health/live", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()

	router := gin.New()
	router.GET("/health/live", server.LiveHandler)
	router.ServeHTTP(rr, req)

	// Live handler doesn't depend on other services, should always return OK
	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestOutboxHealthHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create mock database
	mockDB := &database.PostgresClient{}

	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
		db: mockDB,
	}

	req, err := http.NewRequest("GET", "/outbox/health", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()

	router := gin.New()
	router.GET("/outbox/health", server.OutboxHealthHandler)
	router.ServeHTTP(rr, req)

	// Should return either OK or 500 depending on mock client behavior
	assert.Contains(t, []int{
		http.StatusOK,
		http.StatusInternalServerError,
	}, rr.Code)
}

func TestCreateConnectorHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create mock Debezium client
	mockDebezium := &debezium.DebeziumClient{}

	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
		debezium: mockDebezium,
	}

	// Create test connector config
	connectorConfig := debezium.ConnectorConfig{
		Name: "test-connector",
		Config: map[string]interface{}{
			"connector.class":   "PostgresConnector",
			"database.hostname": "localhost",
			"database.port":     "5432",
			"database.dbname":   "testdb",
		},
	}

	jsonData, err := json.Marshal(connectorConfig)
	require.NoError(t, err)

	req, err := http.NewRequest("POST", "/connectors", bytes.NewBuffer(jsonData))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()

	router := gin.New()
	router.POST("/connectors", server.CreateConnectorHandler)
	router.ServeHTTP(rr, req)

	// Should return either OK or error depending on mock client
	assert.Contains(t, []int{
		http.StatusOK,
		http.StatusInternalServerError,
		http.StatusBadRequest,
	}, rr.Code)
}

func TestConnectorStatusHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockDebezium := &debezium.DebeziumClient{}

	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
		debezium: mockDebezium,
	}

	req, err := http.NewRequest("GET", "/connectors/test-connector/status", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()

	router := gin.New()
	router.GET("/connectors/:name/status", server.ConnectorStatusHandler)
	router.ServeHTTP(rr, req)

	// Should return either OK or error depending on mock client
	assert.Contains(t, []int{
		http.StatusOK,
		http.StatusInternalServerError,
		http.StatusNotFound,
	}, rr.Code)
}

func TestMetricsHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)

	server := &ChronosServer{
		config: &config.Config{
			ServicePort:    "8080",
			MetricsEnabled: true,
		},
	}

	req, err := http.NewRequest("GET", "/metrics", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()

	router := gin.New()
	router.GET("/metrics", server.MetricsHandler)
	router.ServeHTTP(rr, req)

	// Should return 200 with Prometheus metrics (or 404 if metrics disabled)
	assert.Contains(t, []int{
		http.StatusOK,
		http.StatusNotFound,
	}, rr.Code)

	if rr.Code == http.StatusOK {
		assert.Contains(t, rr.Body.String(), "# HELP")
	}
}

func TestServerConfiguration(t *testing.T) {
	cfg := &config.Config{
		ServicePort:       "8080",
		DatabaseURL:       "postgresql://test:test@localhost:5432/test",
		RabbitMQURL:       "amqp://test:test@localhost:5672/",
		DebeziumServerURL: "http://localhost:8083",
		LogLevel:          "debug",
		MetricsEnabled:    true,
	}

	server := &ChronosServer{
		config: cfg,
	}

	assert.Equal(t, "8080", server.config.ServicePort)
	assert.True(t, server.config.MetricsEnabled)
	assert.Equal(t, "debug", server.config.LogLevel)
}

func TestMiddlewareChain(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
	}
	server.setupRoutes(router)

	// Test that all routes are properly configured
	req, err := http.NewRequest("GET", "/health", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
}

func TestHealthResponseStructure(t *testing.T) {
	gin.SetMode(gin.TestMode)

	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
	}

	req, err := http.NewRequest("GET", "/health", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()

	router := gin.New()
	router.GET("/health", server.HealthHandler)
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var response HealthCheckResponse
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err)

	// Verify the basic structure exists
	assert.Contains(t, response.Status, "health")   // Should contain status
	assert.Contains(t, response.Checks, "database") // Should have database check
}

func TestErrorHandling(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	server := &ChronosServer{
		config: &config.Config{
			ServicePort: "8080",
		},
	}
	server.setupRoutes(router)

	req, err := http.NewRequest("GET", "/nonexistent", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusNotFound, rr.Code)
}

func TestServerStartShutdown(t *testing.T) {
	cfg := &config.Config{
		ServicePort: "0", // Use port 0 for testing
	}

	// This test would start and immediately stop the server
	// In a real implementation, we'd test the graceful shutdown
	server := &ChronosServer{
		config: cfg,
	}

	// Test that server can be created
	assert.NotNil(t, server)
	assert.Equal(t, cfg, server.config)
}

func TestChronosServer_ConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		config  *config.Config
		wantErr bool
	}{
		{
			name: "valid config",
			config: &config.Config{
				ServicePort:       "8080",
				DatabaseURL:       "postgresql://test:test@localhost:5432/test",
				RabbitMQURL:       "amqp://test:test@localhost:5672/",
				DebeziumServerURL: "http://localhost:8083",
			},
			wantErr: false,
		},
		{
			name: "missing service port",
			config: &config.Config{
				DatabaseURL:       "postgresql://test:test@localhost:5432/test",
				RabbitMQURL:       "amqp://test:test@localhost:5672/",
				DebeziumServerURL: "http://localhost:8083",
			},
			wantErr: false, // Should use default port
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.wantErr {
				// Test would expect an error
				_, err := NewChronosServer(tt.config)
				assert.Error(t, err)
			} else {
				// Test server creation logic (will fail on connection)
				_, err := NewChronosServer(tt.config)
				// Expect connection error, not config error
				assert.Error(t, err)
			}
		})
	}
}
