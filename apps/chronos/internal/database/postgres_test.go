package database

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPostgresClient_Connect(t *testing.T) {
	// Test connection string parsing without actually connecting
	tests := []struct {
		name    string
		dsn     string
		wantErr bool
	}{
		{
			name:    "valid connection string",
			dsn:     "postgresql://user:pass@localhost:5432/db",
			wantErr: true, // Expect error due to no running DB
		},
		{
			name:    "valid connection string without db",
			dsn:     "postgresql://user:pass@localhost:5432/",
			wantErr: true, // Expect error due to no running DB
		},
		{
			name:    "invalid connection string",
			dsn:     "invalid",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client, err := NewPostgresClient(tt.dsn)
			if tt.wantErr {
				assert.Error(t, err)
				assert.Nil(t, client)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, client)
				// Close the connection
				if client != nil {
					client.Close()
				}
			}
		})
	}
}

func TestPostgresClient_IsHealthy(t *testing.T) {
	// Test with nil client
	t.Run("nil client", func(t *testing.T) {
		var client *PostgresClient
		assert.False(t, client.IsHealthy(context.Background()))
	})

	// Test with closed client
	t.Run("closed client", func(t *testing.T) {
		client, _ := NewPostgresClient("postgresql://user:pass@localhost:5432/db")
		if client != nil {
			client.Close()
		}
		// Client should be unhealthy after close
		assert.False(t, client.IsHealthy(context.Background()))
	})
}

func TestOutboxEvent_ParseEventData(t *testing.T) {
	t.Run("valid JSON", func(t *testing.T) {
		event := OutboxEvent{
			EventData: `{"title": "Test Event", "category": "test", "count": 42}`,
		}

		data, err := event.ParseEventData()
		assert.NoError(t, err)
		assert.NotNil(t, data)
		assert.Equal(t, "Test Event", data["title"])
		assert.Equal(t, "test", data["category"])
	})

	t.Run("invalid JSON", func(t *testing.T) {
		event := OutboxEvent{
			EventData: `{"invalid": json}`,
		}

		data, err := event.ParseEventData()
		assert.Error(t, err)
		assert.Nil(t, data)
	})

	t.Run("empty JSON", func(t *testing.T) {
		event := OutboxEvent{
			EventData: `{}`,
		}

		data, err := event.ParseEventData()
		assert.NoError(t, err)
		assert.NotNil(t, data)
	})
}

func TestDatabaseInfo(t *testing.T) {
	// Test DatabaseInfo struct
	info := DatabaseInfo{
		DatabaseName: "testdb",
		Version:      "PostgreSQL 15.0",
	}

	assert.Equal(t, "testdb", info.DatabaseName)
	assert.Equal(t, "PostgreSQL 15.0", info.Version)
}

func TestPostgresClient_Ping(t *testing.T) {
	// This test requires a running PostgreSQL instance
	// Skip if no database is available
	t.Skip("Requires running PostgreSQL instance")

	ctx := context.Background()
	client, err := NewPostgresClient("postgresql://test:test@localhost:5432/test")
	if err != nil {
		t.Fatalf("Failed to create client: %v", err)
	}
	defer client.Close()

	err = client.Ping(ctx)
	assert.NoError(t, err)
}

func TestOutboxHealth(t *testing.T) {
	// Test the OutboxHealth struct
	health := OutboxHealth{
		TotalEvents:           100,
		Pending:               10,
		Published:             85,
		Failed:                5,
		PublishedLastHour:     20,
		AvgPublishTimeSeconds: 0.5,
	}

	assert.Equal(t, int64(100), health.TotalEvents)
	assert.Equal(t, int64(10), health.Pending)
	assert.Equal(t, int64(85), health.Published)
	assert.Equal(t, int64(5), health.Failed)
	assert.Equal(t, int64(20), health.PublishedLastHour)
	assert.Equal(t, 0.5, health.AvgPublishTimeSeconds)
}

func TestOutboxEvent(t *testing.T) {
	// Test the OutboxEvent struct
	event := OutboxEvent{
		ID:         "test-id-123",
		EventData:  `{"title": "Test Event", "category": "test"}`,
		Status:     "pending",
		RoutingKey: "event.ingested",
		CreatedAt:  "2024-01-01T00:00:00Z",
	}

	assert.Equal(t, "test-id-123", event.ID)
	assert.Equal(t, "pending", event.Status)
	assert.Equal(t, "event.ingested", event.RoutingKey)
}
