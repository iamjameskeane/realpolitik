package rabbitmq

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRabbitMQClient_NewRabbitMQClient(t *testing.T) {
	// Test with valid URL
	_, err := NewRabbitMQClient("amqp://guest:guest@localhost:5672/")
	// Will fail due to no server, but tests the URL parsing
	assert.Error(t, err)

	// Test with invalid URL
	_, err = NewRabbitMQClient("invalid-url")
	assert.Error(t, err)
}

func TestExchangeTopology(t *testing.T) {
	topology := ExchangeTopology{
		Name:       "realpolitik",
		Type:       "topic",
		Durable:    true,
		AutoDelete: false,
		RoutingKeys: []string{
			"event.ingested",
			"analysis.requested",
			"analysis.completed",
		},
		Queues: []QueueConfig{
			{
				Name:      "clio",
				Durable:   true,
				Exclusive: false,
				Bindings: []BindingConfig{
					{
						RoutingKey: "event.ingested",
					},
				},
			},
			{
				Name:      "urania",
				Durable:   true,
				Exclusive: false,
				Bindings: []BindingConfig{
					{
						RoutingKey: "event.ingested",
					},
				},
			},
			{
				Name:      "cassandra",
				Durable:   true,
				Exclusive: false,
				Bindings: []BindingConfig{
					{
						RoutingKey: "analysis.requested",
					},
					{
						RoutingKey: "analysis.completed",
					},
				},
			},
		},
	}

	assert.Equal(t, "realpolitik", topology.Name)
	assert.Equal(t, "topic", topology.Type)
	assert.True(t, topology.Durable)
	assert.Len(t, topology.Queues, 3)

	// Check clio queue
	clio := topology.Queues[0]
	assert.Equal(t, "clio", clio.Name)
	assert.Equal(t, 1, len(clio.Bindings))
	assert.Equal(t, "event.ingested", clio.Bindings[0].RoutingKey)
}

func TestEventMessage(t *testing.T) {
	message := EventMessage{
		ID:         "test-123",
		EventData:  `{"title": "Test Event", "category": "test"}`,
		RoutingKey: "event.ingested",
		Headers: map[string]string{
			"source":    "argus",
			"version":   "1.0",
			"eventType": "geopolitical_event",
		},
		Timestamp: "2024-01-01T00:00:00Z",
	}

	assert.Equal(t, "test-123", message.ID)
	assert.Equal(t, "event.ingested", message.RoutingKey)
	assert.Equal(t, "argus", message.Headers["source"])
	assert.Equal(t, "1.0", message.Headers["version"])
	assert.Equal(t, "geopolitical_event", message.Headers["eventType"])
}

func TestPublishOptions(t *testing.T) {
	opts := PublishOptions{
		Persistent:      true,
		DeliveryMode:    2,
		CorrelationID:   "corr-123",
		ReplyTo:         "response-queue",
		MessageID:       "msg-123",
		ContentType:     "application/json",
		ContentEncoding: "utf-8",
		Priority:        5,
	}

	assert.True(t, opts.Persistent)
	assert.Equal(t, 2, opts.DeliveryMode)
	assert.Equal(t, "corr-123", opts.CorrelationID)
	assert.Equal(t, "response-queue", opts.ReplyTo)
	assert.Equal(t, "msg-123", opts.MessageID)
	assert.Equal(t, "application/json", opts.ContentType)
	assert.Equal(t, "utf-8", opts.ContentEncoding)
	assert.Equal(t, 5, opts.Priority)
}

func TestConnectionOptions(t *testing.T) {
	opts := ConnectionOptions{
		Host:              "localhost",
		Port:              5672,
		Username:          "realpolitik",
		Password:          "secret",
		VHost:             "/",
		Heartbeat:         60,
		ConnectionTimeout: 30,
		ChannelTimeout:    30,
	}

	assert.Equal(t, "localhost", opts.Host)
	assert.Equal(t, 5672, opts.Port)
	assert.Equal(t, "realpolitik", opts.Username)
	assert.Equal(t, "secret", opts.Password)
	assert.Equal(t, "/", opts.VHost)
	assert.Equal(t, 60, opts.Heartbeat)
	assert.Equal(t, 30, opts.ConnectionTimeout)
	assert.Equal(t, 30, opts.ChannelTimeout)
}

func TestRabbitMQError(t *testing.T) {
	t.Run("connection error", func(t *testing.T) {
		err := ErrConnectionFailed("localhost", 5672)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Connection failed")
		assert.Contains(t, err.Error(), "localhost:5672")
	})

	t.Run("channel error", func(t *testing.T) {
		err := ErrChannelFailed("test-operation")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "test-operation")
		assert.Contains(t, err.Error(), "Channel failed")
	})

	t.Run("publish error", func(t *testing.T) {
		err := ErrPublishFailed("test-exchange", "test-routing-key")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "Publish failed")
		assert.Contains(t, err.Error(), "test-exchange")
		assert.Contains(t, err.Error(), "test-routing-key")
	})
}

func TestMessageValidation(t *testing.T) {
	t.Run("valid message", func(t *testing.T) {
		msg := EventMessage{
			ID:         "test-123",
			EventData:  `{"title": "Test"}`,
			RoutingKey: "event.ingested",
			Headers:    map[string]string{},
			Timestamp:  "2024-01-01T00:00:00Z",
		}

		err := msg.IsValid()
		assert.NoError(t, err)
	})

	t.Run("missing ID", func(t *testing.T) {
		msg := EventMessage{
			EventData:  `{"title": "Test"}`,
			RoutingKey: "event.ingested",
			Headers:    map[string]string{},
			Timestamp:  "2024-01-01T00:00:00Z",
		}

		err := msg.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "ID is required")
	})

	t.Run("missing routing key", func(t *testing.T) {
		msg := EventMessage{
			ID:        "test-123",
			EventData: `{"title": "Test"}`,
			Headers:   map[string]string{},
			Timestamp: "2024-01-01T00:00:00Z",
		}

		err := msg.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "RoutingKey is required")
	})

	t.Run("empty event data", func(t *testing.T) {
		msg := EventMessage{
			ID:         "test-123",
			EventData:  "",
			RoutingKey: "event.ingested",
			Headers:    map[string]string{},
			Timestamp:  "2024-01-01T00:00:00Z",
		}

		err := msg.IsValid()
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "EventData is required")
	})
}

func TestExchangeDeclaration(t *testing.T) {
	exchange := ExchangeDeclaration{
		Name:       "realpolitik",
		Type:       "topic",
		Durable:    true,
		AutoDelete: false,
		Internal:   false,
		NoWait:     false,
		Arguments: map[string]interface{}{
			"x-message-ttl": 3600000, // 1 hour
		},
	}

	assert.Equal(t, "realpolitik", exchange.Name)
	assert.Equal(t, "topic", exchange.Type)
	assert.True(t, exchange.Durable)
	assert.False(t, exchange.AutoDelete)
	assert.False(t, exchange.Internal)
	assert.False(t, exchange.NoWait)
	assert.Equal(t, 3600000, exchange.Arguments["x-message-ttl"])
}

func TestQueueDeclaration(t *testing.T) {
	queue := QueueDeclaration{
		Name:       "test-queue",
		Durable:    true,
		Exclusive:  false,
		AutoDelete: false,
		NoWait:     false,
		Arguments: map[string]interface{}{
			"x-dead-letter-exchange":    "dlx",
			"x-dead-letter-routing-key": "failed",
		},
	}

	assert.Equal(t, "test-queue", queue.Name)
	assert.True(t, queue.Durable)
	assert.False(t, queue.Exclusive)
	assert.False(t, queue.AutoDelete)
	assert.False(t, queue.NoWait)
	assert.Contains(t, queue.Arguments, "x-dead-letter-exchange")
}

func TestBindingDeclaration(t *testing.T) {
	binding := BindingDeclaration{
		Source:      "realpolitik",
		Destination: "test-queue",
		RoutingKey:  "event.ingested",
		Arguments: map[string]interface{}{
			"x-match": "all",
		},
	}

	assert.Equal(t, "realpolitik", binding.Source)
	assert.Equal(t, "test-queue", binding.Destination)
	assert.Equal(t, "event.ingested", binding.RoutingKey)
	assert.Contains(t, binding.Arguments, "x-match")
}

func TestConnectionURLParsing(t *testing.T) {
	tests := []struct {
		url      string
		expected ConnectionOptions
		hasError bool
	}{
		{
			url: "amqp://user:pass@localhost:5672/vhost",
			expected: ConnectionOptions{
				Host:     "localhost",
				Port:     5672,
				Username: "user",
				Password: "pass",
				VHost:    "vhost",
			},
			hasError: false,
		},
		{
			url: "amqp://localhost:5672/",
			expected: ConnectionOptions{
				Host:     "localhost",
				Port:     5672,
				Username: "guest",
				Password: "guest",
				VHost:    "/",
			},
			hasError: false,
		},
		{
			url:      "invalid-url",
			expected: ConnectionOptions{},
			hasError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.url, func(t *testing.T) {
			opts, err := ParseConnectionURL(tt.url)

			if tt.hasError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expected.Host, opts.Host)
				assert.Equal(t, tt.expected.Port, opts.Port)
				assert.Equal(t, tt.expected.Username, opts.Username)
				assert.Equal(t, tt.expected.Password, opts.Password)
				assert.Equal(t, tt.expected.VHost, opts.VHost)
			}
		})
	}
}

func TestEventMessageMarshaling(t *testing.T) {
	message := EventMessage{
		ID:         "test-123",
		EventData:  `{"title": "Test Event", "category": "test"}`,
		RoutingKey: "event.ingested",
		Headers: map[string]string{
			"source":  "argus",
			"version": "1.0",
		},
		Timestamp: "2024-01-01T00:00:00Z",
	}

	jsonData, err := message.ToJSON()
	require.NoError(t, err)

	var result map[string]interface{}
	err = message.FromJSON(jsonData)
	require.NoError(t, err)

	assert.Equal(t, "test-123", result["id"])
	assert.Equal(t, "event.ingested", result["routingKey"])
	assert.Equal(t, "argus", result["headers"].(map[string]interface{})["source"])
}

func TestHealthStatus(t *testing.T) {
	status := HealthStatus{
		IsHealthy: true,
		Version:   "3.12.7",
		Uptime:    "1h 30m 45s",
		Connections: []ConnectionStatus{
			{
				Name:     "realpolitik-connection",
				IsOpen:   true,
				User:     "realpolitik",
				Channels: 5,
			},
		},
		Queues: []QueueStatus{
			{
				Name:          0, // Would be a queue ID in real implementation
				MessageCount:  10,
				ConsumerCount: 1,
			},
		},
	}

	assert.True(t, status.IsHealthy)
	assert.Equal(t, "3.12.7", status.Version)
	assert.Equal(t, "1h 30m 45s", status.Uptime)
	assert.Len(t, status.Connections, 1)
	assert.Equal(t, "realpolitik-connection", status.Connections[0].Name)
	assert.True(t, status.Connections[0].IsOpen)
	assert.Len(t, status.Queues, 1)
	assert.Equal(t, "clio", status.Queues[0].Name)
	assert.Equal(t, 10, status.Queues[0].MessageCount)
}
