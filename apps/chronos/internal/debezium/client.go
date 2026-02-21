package debezium

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Constants for connector states
const (
	ConnectorStateRunning = "RUNNING"
	ConnectorStateFailed  = "FAILED"
	ConnectorStateStopped = "STOPPED"
)

// Constants for task states
const (
	TaskStateRunning = "RUNNING"
	TaskStateFailed  = "FAILED"
	TaskStateStopped = "STOPPED"
)

// DebeziumClient handles communication with Debezium Server
type DebeziumClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewDebeziumClient creates a new Debezium client
func NewDebeziumClient(serverURL string) *DebeziumClient {
	return &DebeziumClient{
		baseURL: serverURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// ConnectorConfig represents a Debezium connector configuration
type ConnectorConfig struct {
	Name   string                 `json:"name"`
	Config map[string]interface{} `json:"config"`
}

// ConnectorStatus represents the status of a Debezium connector
type ConnectorStatus struct {
	Name      string `json:"name"`
	Connector struct {
		State  string `json:"state"`
		Worker string `json:"worker,omitempty"`
		Trace  string `json:"trace,omitempty"`
	} `json:"connector"`
	Tasks []TaskStatus `json:"tasks"`
}

// TaskStatus represents the status of a Debezium task
type TaskStatus struct {
	ID     int    `json:"id"`
	State  string `json:"state"`
	Worker string `json:"worker,omitempty"`
	Error  string `json:"error,omitempty"`
}

// CreateConnector creates a new Debezium connector
func (c *DebeziumClient) CreateConnector(ctx context.Context, config *ConnectorConfig) error {
	endpoint := fmt.Sprintf("%s/connectors", c.baseURL)

	payload, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("failed to marshal connector config: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to create connector: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to create connector: status=%d, body=%s", resp.StatusCode, string(body))
	}

	return nil
}

// GetConnectorStatus returns the status of a Debezium connector
func (c *DebeziumClient) GetConnectorStatus(ctx context.Context, name string) (*ConnectorStatus, error) {
	endpoint := fmt.Sprintf("%s/connectors/%s/status", c.baseURL, name)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get connector status: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrConnectorNotFound(name)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get connector status: status=%d, body=%s", resp.StatusCode, string(body))
	}

	var status ConnectorStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("failed to decode connector status: %w", err)
	}

	return &status, nil
}

// DeleteConnector deletes a Debezium connector
func (c *DebeziumClient) DeleteConnector(ctx context.Context, name string) error {
	endpoint := fmt.Sprintf("%s/connectors/%s", c.baseURL, name)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete connector: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to delete connector: status=%d, body=%s", resp.StatusCode, string(body))
	}

	return nil
}

// PauseConnector pauses a Debezium connector
func (c *DebeziumClient) PauseConnector(ctx context.Context, name string) error {
	endpoint := fmt.Sprintf("%s/connectors/%s/pause", c.baseURL, name)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to pause connector: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to pause connector: status=%d, body=%s", resp.StatusCode, string(body))
	}

	return nil
}

// ResumeConnector resumes a Debezium connector
func (c *DebeziumClient) ResumeConnector(ctx context.Context, name string) error {
	endpoint := fmt.Sprintf("%s/connectors/%s/resume", c.baseURL, name)

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to resume connector: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to resume connector: status=%d, body=%s", resp.StatusCode, string(body))
	}

	return nil
}

// RestartConnector restarts a Debezium connector
func (c *DebeziumClient) RestartConnector(ctx context.Context, name string) error {
	endpoint := fmt.Sprintf("%s/connectors/%s/restart", c.baseURL, name)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to restart connector: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to restart connector: status=%d, body=%s", resp.StatusCode, string(body))
	}

	return nil
}

// ListConnectors returns a list of all connectors
func (c *DebeziumClient) ListConnectors(ctx context.Context) ([]string, error) {
	endpoint := fmt.Sprintf("%s/connectors", c.baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to list connectors: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to list connectors: status=%d, body=%s", resp.StatusCode, string(body))
	}

	var connectors []string
	if err := json.NewDecoder(resp.Body).Decode(&connectors); err != nil {
		return nil, fmt.Errorf("failed to decode connectors: %w", err)
	}

	return connectors, nil
}

// IsHealthy checks if the Debezium server is healthy
func (c *DebeziumClient) IsHealthy(ctx context.Context) bool {
	endpoint := fmt.Sprintf("%s/health", c.baseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return false
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

// GetConnectorConfig returns the configuration of a connector
func (c *DebeziumClient) GetConnectorConfig(ctx context.Context, name string) (*ConnectorConfig, error) {
	endpoint := fmt.Sprintf("%s/connectors/%s/config", c.baseURL, name)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get connector config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrConnectorNotFound(name)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("failed to get connector config: status=%d, body=%s", resp.StatusCode, string(body))
	}

	var config map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		return nil, fmt.Errorf("failed to decode connector config: %w", err)
	}

	return &ConnectorConfig{
		Name:   name,
		Config: config,
	}, nil
}

// UpdateConnectorConfig updates the configuration of a connector
func (c *DebeziumClient) UpdateConnectorConfig(ctx context.Context, name string, config *ConnectorConfig) error {
	endpoint := fmt.Sprintf("%s/connectors/%s/config", c.baseURL, name)

	payload, err := json.Marshal(config.Config)
	if err != nil {
		return fmt.Errorf("failed to marshal connector config: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to update connector config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("failed to update connector config: status=%d, body=%s", resp.StatusCode, string(body))
	}

	return nil
}

// DebeziumError represents an error from the Debezium client
type DebeziumError struct {
	Message string
	Status  int
}

func (e *DebeziumError) Error() string {
	return fmt.Sprintf("Debezium error: %s (status=%d)", e.Message, e.Status)
}

// NewDebeziumError creates a new Debezium error
func NewDebeziumError(message string, status int) *DebeziumError {
	return &DebeziumError{
		Message: message,
		Status:  status,
	}
}

// ErrConnectorNotFound returns an error for when a connector is not found
func ErrConnectorNotFound(name string) *DebeziumError {
	return &DebeziumError{
		Message: fmt.Sprintf("Connector '%s' not found", name),
		Status:  404,
	}
}
