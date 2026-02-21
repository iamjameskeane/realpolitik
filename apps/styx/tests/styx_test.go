package styx_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/realpolitik/realpolitik/apps/styx/internal/config"
	"github.com/realpolitik/realpolitik/apps/styx/internal/gateway"
	"github.com/realpolitik/realpolitik/apps/styx/internal/health"
	"github.com/realpolitik/realpolitik/apps/styx/internal/logging"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNewGateway tests the creation of a new gateway
func TestNewGateway(t *testing.T) {
	cfg := &config.Config{
		DelphiURL: "http://localhost:8000",
		HermesURL: "http://localhost:8002",
		PythiaURL: "http://localhost:8001",
		Port:      8080,
	}

	healthChecker := health.NewChecker()
	logger := logging.NewLogger()

	gw, err := gateway.NewGateway(cfg, healthChecker, logger)

	require.NoError(t, err)
	assert.NotNil(t, gw)
}

// TestGatewayRootHandler tests the root endpoint
func TestGatewayRootHandler(t *testing.T) {
	cfg := &config.Config{
		DelphiURL: "http://localhost:8000",
		HermesURL: "http://localhost:8002",
		PythiaURL: "http://localhost:8001",
		Port:      8080,
	}

	healthChecker := health.NewChecker()
	logger := logging.NewLogger()

	gw, err := gateway.NewGateway(cfg, healthChecker, logger)
	require.NoError(t, err)

	// Test root endpoint
	req := httptest.NewRequest("GET", "/", nil)
	rr := httptest.NewRecorder()

	gw.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "styx-gateway", response["service"])
	assert.Equal(t, "0.1.0", response["version"])
}

// TestGatewayHealthHandler tests the health endpoint
func TestGatewayHealthHandler(t *testing.T) {
	cfg := &config.Config{
		DelphiURL: "http://localhost:8000",
		HermesURL: "http://localhost:8002",
		PythiaURL: "http://localhost:8001",
		Port:      8080,
	}

	healthChecker := health.NewChecker()
	logger := logging.NewLogger()

	gw, err := gateway.NewGateway(cfg, healthChecker, logger)
	require.NoError(t, err)

	// Test /health endpoint
	req := httptest.NewRequest("GET", "/health", nil)
	rr := httptest.NewRecorder()

	gw.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))
}

// TestGatewayReadinessHandler tests the readiness endpoint
func TestGatewayReadinessHandler(t *testing.T) {
	cfg := &config.Config{
		DelphiURL: "http://localhost:8000",
		HermesURL: "http://localhost:8002",
		PythiaURL: "http://localhost:8001",
		Port:      8080,
	}

	healthChecker := health.NewChecker()
	logger := logging.NewLogger()

	gw, err := gateway.NewGateway(cfg, healthChecker, logger)
	require.NoError(t, err)

	// Test /health/ready endpoint
	req := httptest.NewRequest("GET", "/health/ready", nil)
	rr := httptest.NewRecorder()

	gw.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))

	var response map[string]interface{}
	err = json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "ready", response["status"])
}

// TestConfig tests configuration access
func TestConfig(t *testing.T) {
	cfg := &config.Config{
		DelphiURL: "http://localhost:8000",
		HermesURL: "http://localhost:8002",
		PythiaURL: "http://localhost:8001",
		Port:      8080,
	}

	healthChecker := health.NewChecker()
	logger := logging.NewLogger()

	gw, err := gateway.NewGateway(cfg, healthChecker, logger)
	require.NoError(t, err)

	assert.Equal(t, cfg, gw.GetConfig())
}

// TestConfigLoad tests configuration loading
func TestConfigLoad(t *testing.T) {
	cfg, err := config.Load()

	require.NoError(t, err)
	assert.NotNil(t, cfg)

	// Test default values
	assert.Equal(t, "development", cfg.Environment)
	assert.Equal(t, 8080, cfg.Port)
	assert.Equal(t, "http://delphi:8000", cfg.DelphiURL)
	assert.Equal(t, "http://hermes:8002", cfg.HermesURL)
	assert.Equal(t, "http://pythia:8001", cfg.PythiaURL)
}
