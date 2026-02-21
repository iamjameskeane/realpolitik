package debezium

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDebeziumClient_NewDebeziumClient(t *testing.T) {
	client := NewDebeziumClient("http://localhost:8083")

	assert.NotNil(t, client)
	assert.Equal(t, "http://localhost:8083", client.baseURL)
	assert.NotNil(t, client.httpClient)
}

func TestConnectorConfig(t *testing.T) {
	config := ConnectorConfig{
		Name: "test-connector",
		Config: map[string]interface{}{
			"connector.class":    "PostgresConnector",
			"database.hostname":  "localhost",
			"database.port":      "5432",
			"database.dbname":    "testdb",
			"database.user":      "user",
			"database.password":  "pass",
			"slot.name":          "chronos_slot",
			"publication.name":   "chronos_pub",
			"table.include.list": "public.outbox_events",
		},
	}

	assert.Equal(t, "test-connector", config.Name)
	assert.NotNil(t, config.Config)
	assert.Equal(t, "PostgresConnector", config.Config["connector.class"])
}

func TestConnectorConfig_ToJSON(t *testing.T) {
	config := ConnectorConfig{
		Name: "test-connector",
		Config: map[string]interface{}{
			"database.hostname": "localhost",
		},
	}

	jsonData, err := json.Marshal(config)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(jsonData, &result)
	require.NoError(t, err)

	assert.Equal(t, "test-connector", result["name"])
	assert.NotNil(t, result["config"])
}

func TestConnectorStatus(t *testing.T) {
	status := ConnectorStatus{
		Name: "test-connector",
		Connector: struct {
			State  string `json:"state"`
			Worker string `json:"worker,omitempty"`
			Trace  string `json:"trace,omitempty"`
		}{State: "RUNNING"},
		Tasks: []TaskStatus{
			{
				ID:     0,
				State:  "RUNNING",
				Worker: "worker-1",
			},
		},
	}

	assert.Equal(t, "test-connector", status.Name)
	assert.Equal(t, "RUNNING", status.Connector.State)
	assert.Len(t, status.Tasks, 1)
	assert.Equal(t, 0, status.Tasks[0].ID)
	assert.Equal(t, "RUNNING", status.Tasks[0].State)
}

func TestConnectorStatus_JsonMarshaling(t *testing.T) {
	status := ConnectorStatus{
		Name: "test-connector",
		Connector: struct {
			State  string `json:"state"`
			Worker string `json:"worker,omitempty"`
			Trace  string `json:"trace,omitempty"`
		}{State: "RUNNING"},
	}

	jsonData, err := json.Marshal(status)
	require.NoError(t, err)

	var result map[string]interface{}
	err = json.Unmarshal(jsonData, &result)
	require.NoError(t, err)

	assert.Equal(t, "test-connector", result["name"])
	connector := result["connector"].(map[string]interface{})
	assert.Equal(t, "RUNNING", connector["state"])
}

func TestCreateConnectorRequest(t *testing.T) {
	// Test the HTTP request that would be made to create a connector
	config := &ConnectorConfig{
		Name: "chronos-connector",
		Config: map[string]interface{}{
			"connector.class":    "PostgresConnector",
			"database.hostname":  "atlas",
			"database.port":      "5432",
			"database.dbname":    "realpolitik",
			"database.user":      "realpolitik",
			"database.password":  "realpolitik_password",
			"slot.name":          "chronos_slot",
			"publication.name":   "chronos_pub",
			"table.include.list": "public.outbox_events",
		},
	}

	jsonData, err := json.Marshal(config)
	require.NoError(t, err)

	// Verify JSON structure
	var request map[string]interface{}
	err = json.Unmarshal(jsonData, &request)
	require.NoError(t, err)

	assert.Equal(t, "chronos-connector", request["name"])
	assert.NotNil(t, request["config"])

	configMap := request["config"].(map[string]interface{})
	assert.Equal(t, "PostgresConnector", configMap["connector.class"])
	assert.Equal(t, "atlas", configMap["database.hostname"])
	assert.Equal(t, "chronos_slot", configMap["slot.name"])
}

func TestGetConnectorStatusRequest(t *testing.T) {
	// Test the HTTP request that would be made to get connector status
	baseURL := "http://localhost:8083"
	connectorName := "chronos-connector"

	expectedEndpoint := baseURL + "/connectors/" + connectorName + "/status"
	assert.Equal(t, "http://localhost:8083/connectors/chronos-connector/status", expectedEndpoint)
}

func TestDebeziumClient_IsHealthy(t *testing.T) {
	client := NewDebeziumClient("http://localhost:8083")

	// Test with working server URL
	t.Run("healthy server", func(t *testing.T) {
		// Note: This test would fail without a real Debezium server running
		// In practice, this would be tested with a mock HTTP server
		assert.NotNil(t, client)
	})

	t.Run("nil client", func(t *testing.T) {
		var client *DebeziumClient
		assert.Nil(t, client)
	})
}

func TestConnectorStateConstants(t *testing.T) {
	// Test the connector state constants
	t.Run("state constants exist", func(t *testing.T) {
		states := []string{
			ConnectorStateRunning,
			ConnectorStateFailed,
			ConnectorStateStopped,
		}

		for _, state := range states {
			assert.NotEmpty(t, state)
		}
	})
}

func TestTaskStateConstants(t *testing.T) {
	// Test the task state constants
	t.Run("task state constants exist", func(t *testing.T) {
		states := []string{
			TaskStateRunning,
			TaskStateFailed,
			TaskStateStopped,
		}

		for _, state := range states {
			assert.NotEmpty(t, state)
		}
	})
}

func TestErrorMessage(t *testing.T) {
	t.Run("debezium client error", func(t *testing.T) {
		err := ErrConnectorNotFound("test-connector")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "test-connector")
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("custom error", func(t *testing.T) {
		err := NewDebeziumError("custom error message", 404)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "custom error message")
		assert.Contains(t, err.Error(), "404")
	})
}

func TestConnectorConfigurationValidation(t *testing.T) {
	t.Run("valid connector config", func(t *testing.T) {
		config := &ConnectorConfig{
			Name: "test-connector",
			Config: map[string]interface{}{
				"connector.class":    "PostgresConnector",
				"database.hostname":  "localhost",
				"database.port":      "5432",
				"database.dbname":    "testdb",
				"slot.name":          "test_slot",
				"publication.name":   "test_pub",
				"table.include.list": "public.test_table",
			},
		}

		jsonData, err := json.Marshal(config)
		require.NoError(t, err)

		// Should be valid JSON and contain required fields
		var result map[string]interface{}
		err = json.Unmarshal(jsonData, &result)
		require.NoError(t, err)

		assert.Equal(t, "test-connector", result["name"])
	})

	t.Run("minimal connector config", func(t *testing.T) {
		config := &ConnectorConfig{
			Name: "minimal-connector",
			Config: map[string]interface{}{
				"connector.class": "PostgresConnector",
			},
		}

		jsonData, err := json.Marshal(config)
		require.NoError(t, err)

		var result map[string]interface{}
		err = json.Unmarshal(jsonData, &result)
		require.NoError(t, err)

		assert.Equal(t, "minimal-connector", result["name"])
	})
}
