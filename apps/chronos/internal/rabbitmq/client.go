package rabbitmq

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"
	"time"

	"github.com/streadway/amqp"
)

// RabbitMQClient handles communication with RabbitMQ
type RabbitMQClient struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	url     string
	config  ConnectionOptions
}

// NewRabbitMQClient creates a new RabbitMQ client
func NewRabbitMQClient(url string) (*RabbitMQClient, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, ErrConnectionFailed("localhost", 5672)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, ErrChannelFailed("channel creation")
	}

	client := &RabbitMQClient{
		conn:    conn,
		channel: channel,
		url:     url,
	}

	return client, nil
}

// SetupTopology sets up the exchange and queue topology for Chronos
func (c *RabbitMQClient) SetupTopology() error {
	// Create main exchange
	err := c.channel.ExchangeDeclare(
		"realpolitik", // name
		"topic",       // type
		true,          // durable
		false,         // auto-deleted
		false,         // internal
		false,         // no-wait
		nil,           // args
	)
	if err != nil {
		return ErrChannelFailed("exchange declaration")
	}

	// Setup queues for fanout
	queues := []QueueConfig{
		{
			Name:       "clio",
			Durable:    true,
			Exclusive:  false,
			AutoDelete: false,
			Bindings: []BindingConfig{
				{
					RoutingKey: "event.ingested",
				},
			},
		},
		{
			Name:       "urania",
			Durable:    true,
			Exclusive:  false,
			AutoDelete: false,
			Bindings: []BindingConfig{
				{
					RoutingKey: "event.ingested",
				},
			},
		},
		{
			Name:       "cassandra",
			Durable:    true,
			Exclusive:  false,
			AutoDelete: false,
			Bindings: []BindingConfig{
				{
					RoutingKey: "analysis.requested",
				},
				{
					RoutingKey: "analysis.completed",
				},
			},
		},
	}

	for _, queueConfig := range queues {
		// Declare queue
		_, err = c.channel.QueueDeclare(
			queueConfig.Name,
			queueConfig.Durable,
			queueConfig.AutoDelete,
			queueConfig.Exclusive,
			false, // no-wait
			nil,   // args
		)
		if err != nil {
			return ErrChannelFailed("queue declaration: " + queueConfig.Name)
		}

		// Bind queue to exchange
		for _, binding := range queueConfig.Bindings {
			err = c.channel.QueueBind(
				queueConfig.Name,
				binding.RoutingKey,
				"realpolitik",
				false, // no-wait
				nil,   // args
			)
			if err != nil {
				return ErrChannelFailed("queue binding: " + queueConfig.Name)
			}
		}
	}

	return nil
}

// PublishEvent publishes an event to the exchange
func (c *RabbitMQClient) PublishEvent(ctx context.Context, msg *EventMessage) error {
	if err := msg.IsValid(); err != nil {
		return fmt.Errorf("invalid message: %w", err)
	}

	// Convert message to JSON
	messageBody, err := msg.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Set up message properties
	headers := make(amqp.Table)
	for k, v := range msg.Headers {
		headers[k] = v
	}
	headers["timestamp"] = msg.Timestamp
	headers["source"] = msg.Headers["source"]

	// Publish message
	err = c.channel.Publish(
		"realpolitik",  // exchange
		msg.RoutingKey, // routing key
		false,          // mandatory
		false,          // immediate
		amqp.Publishing{
			ContentType:     "application/json",
			ContentEncoding: "utf-8",
			DeliveryMode:    amqp.Persistent,
			CorrelationId:   msg.ID,
			MessageId:       msg.ID,
			Timestamp:       time.Now(),
			Headers:         headers,
			Body:            messageBody,
		},
	)
	if err != nil {
		return ErrPublishFailed("realpolitik", msg.RoutingKey)
	}

	return nil
}

// Close closes the RabbitMQ connection
func (c *RabbitMQClient) Close() error {
	var errors []error

	if c.channel != nil {
		if err := c.channel.Close(); err != nil {
			errors = append(errors, fmt.Errorf("channel close error: %w", err))
		}
	}

	if c.conn != nil {
		if err := c.conn.Close(); err != nil {
			errors = append(errors, fmt.Errorf("connection close error: %w", err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("errors closing RabbitMQ connection: %v", errors)
	}

	return nil
}

// EventMessage represents an event message
type EventMessage struct {
	ID         string            `json:"id"`
	EventData  string            `json:"eventData"`
	RoutingKey string            `json:"routingKey"`
	Headers    map[string]string `json:"headers"`
	Timestamp  string            `json:"timestamp"`
}

// IsValid validates the event message
func (m *EventMessage) IsValid() error {
	if m.ID == "" {
		return fmt.Errorf("ID is required")
	}
	if m.EventData == "" {
		return fmt.Errorf("EventData is required")
	}
	if m.RoutingKey == "" {
		return fmt.Errorf("RoutingKey is required")
	}
	if m.Timestamp == "" {
		return fmt.Errorf("Timestamp is required")
	}
	return nil
}

// ToJSON converts the message to JSON
func (m *EventMessage) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

// FromJSON converts JSON to message
func (m *EventMessage) FromJSON(data []byte) error {
	return json.Unmarshal(data, m)
}

// ExchangeTopology represents the topology for event fanout
type ExchangeTopology struct {
	Name        string        `json:"name"`
	Type        string        `json:"type"`
	Durable     bool          `json:"durable"`
	AutoDelete  bool          `json:"autoDelete"`
	RoutingKeys []string      `json:"routingKeys"`
	Queues      []QueueConfig `json:"queues"`
}

// QueueConfig represents a queue configuration
type QueueConfig struct {
	Name       string          `json:"name"`
	Durable    bool            `json:"durable"`
	Exclusive  bool            `json:"exclusive"`
	AutoDelete bool            `json:"autoDelete"`
	Bindings   []BindingConfig `json:"bindings"`
}

// BindingConfig represents a binding configuration
type BindingConfig struct {
	RoutingKey string                 `json:"routingKey"`
	Arguments  map[string]interface{} `json:"arguments,omitempty"`
}

// PublishOptions represents publishing options
type PublishOptions struct {
	Persistent      bool              `json:"persistent"`
	DeliveryMode    uint8             `json:"deliveryMode"`
	CorrelationID   string            `json:"correlationId"`
	ReplyTo         string            `json:"replyTo"`
	MessageID       string            `json:"messageId"`
	ContentType     string            `json:"contentType"`
	ContentEncoding string            `json:"contentEncoding"`
	Priority        uint8             `json:"priority"`
	Headers         map[string]string `json:"headers"`
}

// ConnectionOptions represents connection options
type ConnectionOptions struct {
	Host              string
	Port              int
	Username          string
	Password          string
	VHost             string
	Heartbeat         int
	ConnectionTimeout int
	ChannelTimeout    int
}

// ParseConnectionURL parses a RabbitMQ connection URL
func ParseConnectionURL(urlStr string) (*ConnectionOptions, error) {
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return nil, err
	}

	port, _ := strconv.Atoi(parsedURL.Port())
	if port == 0 {
		port = 5672
	}

	username := parsedURL.User.Username()
	password, _ := parsedURL.User.Password()

	vhost := parsedURL.Path
	if vhost == "" {
		vhost = "/"
	}

	return &ConnectionOptions{
		Host:              parsedURL.Hostname(),
		Port:              port,
		Username:          username,
		Password:          password,
		VHost:             vhost,
		Heartbeat:         60,
		ConnectionTimeout: 30,
		ChannelTimeout:    30,
	}, nil
}

// ExchangeDeclaration represents an exchange declaration
type ExchangeDeclaration struct {
	Name       string                 `json:"name"`
	Type       string                 `json:"type"`
	Durable    bool                   `json:"durable"`
	AutoDelete bool                   `json:"autoDelete"`
	Internal   bool                   `json:"internal"`
	NoWait     bool                   `json:"noWait"`
	Arguments  map[string]interface{} `json:"arguments"`
}

// QueueDeclaration represents a queue declaration
type QueueDeclaration struct {
	Name       string                 `json:"name"`
	Durable    bool                   `json:"durable"`
	Exclusive  bool                   `json:"exclusive"`
	AutoDelete bool                   `json:"autoDelete"`
	NoWait     bool                   `json:"noWait"`
	Arguments  map[string]interface{} `json:"arguments"`
}

// BindingDeclaration represents a binding declaration
type BindingDeclaration struct {
	Source      string                 `json:"source"`
	Destination string                 `json:"destination"`
	RoutingKey  string                 `json:"routingKey"`
	Arguments   map[string]interface{} `json:"arguments"`
}

// HealthStatus represents the health status of RabbitMQ
type HealthStatus struct {
	IsHealthy   bool               `json:"isHealthy"`
	Version     string             `json:"version"`
	Uptime      string             `json:"uptime"`
	Connections []ConnectionStatus `json:"connections"`
	Queues      []QueueStatus      `json:"queues"`
}

// ConnectionStatus represents connection status
type ConnectionStatus struct {
	Name     string `json:"name"`
	IsOpen   bool   `json:"isOpen"`
	User     string `json:"user"`
	Channels int    `json:"channels"`
}

// QueueStatus represents queue status
type QueueStatus struct {
	Name          int `json:"name"`
	MessageCount  int `json:"messageCount"`
	ConsumerCount int `json:"consumerCount"`
}

// ConnectionInfo represents connection information
type ConnectionInfo struct {
	State            string           `json:"state"`
	RemoteAddr       string           `json:"remoteAddr"`
	LocalAddr        string           `json:"localAddr"`
	Properties       amqp.Table       `json:"properties"`
	FrameMax         uint32           `json:"frameMax"`
	ChannelMax       uint32           `json:"channelMax"`
	ClientProperties ClientProperties `json:"clientProperties"`
}

// ClientProperties represents client properties
type ClientProperties struct {
	Product      string          `json:"product"`
	Version      string          `json:"version"`
	Platform     string          `json:"platform"`
	Capabilities map[string]bool `json:"capabilities"`
}

// RabbitMQError represents an error from RabbitMQ operations
type RabbitMQError struct {
	Operation string
	Message   string
	Cause     error
}

func (e *RabbitMQError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("RabbitMQ %s failed: %s - %v", e.Operation, e.Message, e.Cause)
	}
	return fmt.Sprintf("RabbitMQ %s failed: %s", e.Operation, e.Message)
}

// ErrConnectionFailed returns a connection failed error
func ErrConnectionFailed(host string, port int) *RabbitMQError {
	return &RabbitMQError{
		Operation: "connection",
		Message:   fmt.Sprintf("Connection failed to %s:%d", host, port),
	}
}

// ErrChannelFailed returns a channel operation failed error
func ErrChannelFailed(operation string) *RabbitMQError {
	return &RabbitMQError{
		Operation: "channel",
		Message:   fmt.Sprintf("Channel %s failed", operation),
	}
}

// ErrPublishFailed returns a publish operation failed error
func ErrPublishFailed(exchange, routingKey string) *RabbitMQError {
	return &RabbitMQError{
		Operation: "publish",
		Message:   fmt.Sprintf("Publish to %s with routing key %s failed", exchange, routingKey),
	}
}
