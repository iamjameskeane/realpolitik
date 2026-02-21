package service

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/realpolitik/chronos/internal/config"
	"github.com/realpolitik/chronos/internal/database"
	"github.com/realpolitik/chronos/internal/debezium"
	"github.com/realpolitik/chronos/internal/rabbitmq"
)

// ChronosServer represents the main HTTP server for Chronos
type ChronosServer struct {
	config   *config.Config
	db       *database.PostgresClient
	debezium *debezium.DebeziumClient
	rabbitmq *rabbitmq.RabbitMQClient
	metrics  *MetricsCollector
}

// HealthCheck represents the health check response
type HealthCheck struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks"`
}

// HealthCheckResponse represents the health check response
type HealthCheckResponse struct {
	Status    string            `json:"status"`
	Timestamp time.Time         `json:"timestamp"`
	Checks    map[string]string `json:"checks"`
}

// MetricsCollector collects Prometheus metrics
type MetricsCollector struct {
	// Fields will be added for Prometheus metrics
}

// NewChronosServer creates a new Chronos server
func NewChronosServer(cfg *config.Config) (*ChronosServer, error) {
	// Create database client
	db, err := database.NewPostgresClient(cfg.GetDatabaseConnectionString())
	if err != nil {
		return nil, fmt.Errorf("failed to create database client: %w", err)
	}

	// Create Debezium client
	debezium := debezium.NewDebeziumClient(cfg.DebeziumServerURL)

	// Create RabbitMQ client
	rabbitmq, err := rabbitmq.NewRabbitMQClient(cfg.GetRabbitMQConnectionString())
	if err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to create RabbitMQ client: %w", err)
	}

	// Create metrics collector
	metrics := NewMetricsCollector()

	return &ChronosServer{
		config:   cfg,
		db:       db,
		debezium: debezium,
		rabbitmq: rabbitmq,
		metrics:  metrics,
	}, nil
}

// Start starts the HTTP server
func (s *ChronosServer) Start() error {
	// Set Gin mode
	gin.SetMode(gin.ReleaseMode)

	// Create router
	router := gin.Default()

	// Setup routes
	s.setupRoutes(router)

	// Start server
	addr := ":" + s.config.ServicePort
	return router.Run(addr)
}

// setupRoutes configures all HTTP routes
func (s *ChronosServer) setupRoutes(router *gin.Engine) {
	// Health endpoints
	router.GET("/health", s.HealthHandler)
	router.GET("/health/ready", s.ReadyHandler)
	router.GET("/health/live", s.LiveHandler)

	// Monitoring endpoints
	if s.config.MetricsEnabled {
		router.GET("/metrics", s.MetricsHandler)
	}

	// Debezium management endpoints
	router.POST("/connectors", s.CreateConnectorHandler)
	router.GET("/connectors/:name/status", s.ConnectorStatusHandler)
	router.DELETE("/connectors/:name", s.DeleteConnectorHandler)
	router.PUT("/connectors/:name/pause", s.PauseConnectorHandler)
	router.PUT("/connectors/:name/resume", s.ResumeConnectorHandler)
	router.POST("/connectors/:name/restart", s.RestartConnectorHandler)
	router.GET("/connectors", s.ListConnectorsHandler)

	// Outbox monitoring endpoints
	router.GET("/outbox/health", s.OutboxHealthHandler)
	router.GET("/outbox/events/pending", s.GetPendingOutboxEventsHandler)

	// RabbitMQ endpoints
	router.GET("/rabbitmq/health", s.RabbitMQHealthHandler)
	router.GET("/rabbitmq/topology", s.RabbitMQTopologyHandler)

	// Root endpoint
	router.GET("/", s.RootHandler)
}

// HealthHandler returns the overall health status
func (s *ChronosServer) HealthHandler(c *gin.Context) {
	health := s.getOverallHealth()
	c.JSON(http.StatusOK, HealthCheckResponse{
		Status:    health.Status,
		Timestamp: health.Timestamp,
		Checks:    health.Checks,
	})
}

// ReadyHandler returns readiness status
func (s *ChronosServer) ReadyHandler(c *gin.Context) {
	checks := s.getReadinessChecks()
	allReady := true

	for _, status := range checks {
		if status != "ready" {
			allReady = false
			break
		}
	}

	if allReady {
		c.JSON(http.StatusOK, gin.H{
			"status":    "ready",
			"timestamp": time.Now(),
		})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":    "not ready",
			"timestamp": time.Now(),
			"checks":    checks,
		})
	}
}

// LiveHandler returns liveness status
func (s *ChronosServer) LiveHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "alive",
		"timestamp": time.Now(),
	})
}

// MetricsHandler returns Prometheus metrics
func (s *ChronosServer) MetricsHandler(c *gin.Context) {
	if !s.config.MetricsEnabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "metrics not enabled"})
		return
	}

	promhttp.Handler().ServeHTTP(c.Writer, c.Request)
}

// CreateConnectorHandler creates a new Debezium connector
func (s *ChronosServer) CreateConnectorHandler(c *gin.Context) {
	var connectorConfig debezium.ConnectorConfig

	if err := c.ShouldBindJSON(&connectorConfig); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid connector configuration",
			"details": err.Error(),
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	if err := s.debezium.CreateConnector(ctx, &connectorConfig); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to create connector",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "connector created successfully",
		"name":    connectorConfig.Name,
	})
}

// ConnectorStatusHandler returns the status of a connector
func (s *ChronosServer) ConnectorStatusHandler(c *gin.Context) {
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	status, err := s.debezium.GetConnectorStatus(ctx, name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to get connector status",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, status)
}

// DeleteConnectorHandler deletes a connector
func (s *ChronosServer) DeleteConnectorHandler(c *gin.Context) {
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := s.debezium.DeleteConnector(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to delete connector",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "connector deleted successfully",
		"name":    name,
	})
}

// PauseConnectorHandler pauses a connector
func (s *ChronosServer) PauseConnectorHandler(c *gin.Context) {
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := s.debezium.PauseConnector(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to pause connector",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "connector paused successfully",
		"name":    name,
	})
}

// ResumeConnectorHandler resumes a connector
func (s *ChronosServer) ResumeConnectorHandler(c *gin.Context) {
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := s.debezium.ResumeConnector(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to resume connector",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "connector resumed successfully",
		"name":    name,
	})
}

// RestartConnectorHandler restarts a connector
func (s *ChronosServer) RestartConnectorHandler(c *gin.Context) {
	name := c.Param("name")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	if err := s.debezium.RestartConnector(ctx, name); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to restart connector",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "connector restarted successfully",
		"name":    name,
	})
}

// ListConnectorsHandler lists all connectors
func (s *ChronosServer) ListConnectorsHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	connectors, err := s.debezium.ListConnectors(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to list connectors",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"connectors": connectors,
		"count":      len(connectors),
	})
}

// OutboxHealthHandler returns outbox health information
func (s *ChronosServer) OutboxHealthHandler(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	health, err := s.db.GetOutboxHealth(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to get outbox health",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"outbox_health": health,
		"timestamp":     time.Now(),
	})
}

// GetPendingOutboxEventsHandler returns pending outbox events
func (s *ChronosServer) GetPendingOutboxEventsHandler(c *gin.Context) {
	limit := 100
	if c.Query("limit") != "" {
		if parsedLimit, err := fmt.Sscanf(c.Query("limit"), "%d", &limit); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "invalid limit parameter",
			})
			return
		} else if parsedLimit != 1 || limit < 1 || limit > 1000 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "limit must be between 1 and 1000",
			})
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	events, err := s.db.GetPendingOutboxEvents(ctx, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to get pending events",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"events": events,
		"count":  len(events),
		"limit":  limit,
	})
}

// RabbitMQHealthHandler returns RabbitMQ health status
func (s *ChronosServer) RabbitMQHealthHandler(c *gin.Context) {
	// Create health status from available information
	health := rabbitmq.HealthStatus{
		IsHealthy: true,     // TODO: Implement proper health check
		Version:   "3.12.7", // Would be retrieved from actual connection
		Uptime:    "N/A",    // Would be tracked separately
	}

	c.JSON(http.StatusOK, gin.H{
		"rabbitmq_health": health,
		"timestamp":       time.Now(),
	})
}

// RabbitMQTopologyHandler returns RabbitMQ topology information
func (s *ChronosServer) RabbitMQTopologyHandler(c *gin.Context) {
	topology := rabbitmq.ExchangeTopology{
		Name:       "realpolitik",
		Type:       "topic",
		Durable:    true,
		AutoDelete: false,
		RoutingKeys: []string{
			"event.ingested",
			"analysis.requested",
			"analysis.completed",
		},
		Queues: []rabbitmq.QueueConfig{
			{
				Name:      "clio",
				Durable:   true,
				Exclusive: false,
				Bindings: []rabbitmq.BindingConfig{
					{RoutingKey: "event.ingested"},
				},
			},
			{
				Name:      "urania",
				Durable:   true,
				Exclusive: false,
				Bindings: []rabbitmq.BindingConfig{
					{RoutingKey: "event.ingested"},
				},
			},
			{
				Name:      "cassandra",
				Durable:   true,
				Exclusive: false,
				Bindings: []rabbitmq.BindingConfig{
					{RoutingKey: "analysis.requested"},
					{RoutingKey: "analysis.completed"},
				},
			},
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"topology":  topology,
		"timestamp": time.Now(),
	})
}

// RootHandler returns basic information about the service
func (s *ChronosServer) RootHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"name":        "Chronos",
		"version":     "1.0.0",
		"description": "Change Data Capture pipeline for Realpolitik",
		"health":      "/health",
		"ready":       "/health/ready",
		"live":        "/health/live",
		"metrics":     "/metrics",
		"connectors":  "/connectors",
		"outbox":      "/outbox",
	})
}

// getOverallHealth returns the overall health status
func (s *ChronosServer) getOverallHealth() *HealthCheck {
	checks := make(map[string]string)

	// Check database
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if s.db.IsHealthy(ctx) {
		checks["database"] = "healthy"
	} else {
		checks["database"] = "unhealthy"
	}

	// Check Debezium
	ctx, cancel = context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if s.debezium.IsHealthy(ctx) {
		checks["debezium"] = "healthy"
	} else {
		checks["debezium"] = "unhealthy"
	}

	// Check RabbitMQ (simplified check)
	checks["rabbitmq"] = "healthy" // TODO: Implement proper health check

	// Determine overall status
	status := "healthy"
	for _, checkStatus := range checks {
		if checkStatus == "unhealthy" {
			status = "unhealthy"
			break
		}
	}

	return &HealthCheck{
		Status:    status,
		Timestamp: time.Now(),
		Checks:    checks,
	}
}

// getReadinessChecks returns readiness check results
func (s *ChronosServer) getReadinessChecks() map[string]string {
	checks := make(map[string]string)

	ctx := context.Background()

	// Database readiness
	if s.db.IsHealthy(ctx) {
		checks["database"] = "ready"
	} else {
		checks["database"] = "not ready"
	}

	// Debezium readiness
	if s.debezium.IsHealthy(ctx) {
		checks["debezium"] = "ready"
	} else {
		checks["debezium"] = "not ready"
	}

	return checks
}

// Close closes all connections
func (s *ChronosServer) Close() error {
	var errors []error

	if s.db != nil {
		s.db.Close()
	}

	if s.rabbitmq != nil {
		if err := s.rabbitmq.Close(); err != nil {
			errors = append(errors, err)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("errors closing server: %v", errors)
	}

	return nil
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector() *MetricsCollector {
	// Initialize Prometheus metrics here
	return &MetricsCollector{}
}
