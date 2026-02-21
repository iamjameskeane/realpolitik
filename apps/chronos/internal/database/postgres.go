package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

// PostgresClient handles PostgreSQL database operations
type PostgresClient struct {
	db *sql.DB
}

// NewPostgresClient creates a new PostgreSQL client
func NewPostgresClient(dsn string) (*PostgresClient, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Configure connection pool
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &PostgresClient{db: db}, nil
}

// Close closes the database connection
func (c *PostgresClient) Close() {
	if c.db != nil {
		c.db.Close()
	}
}

// Ping tests the database connection
func (c *PostgresClient) Ping(ctx context.Context) error {
	return c.db.PingContext(ctx)
}

// GetOutboxHealth returns health metrics from the outbox_health view
func (c *PostgresClient) GetOutboxHealth(ctx context.Context) (*OutboxHealth, error) {
	query := `
		SELECT 
			total_events,
			pending,
			published,
			failed,
			published_last_hour,
			avg_publish_time_seconds
		FROM outbox_health
	`

	var health OutboxHealth
	err := c.db.QueryRowContext(ctx, query).Scan(
		&health.TotalEvents,
		&health.Pending,
		&health.Published,
		&health.Failed,
		&health.PublishedLastHour,
		&health.AvgPublishTimeSeconds,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get outbox health: %w", err)
	}

	return &health, nil
}

// GetPendingOutboxEvents returns pending outbox events for processing
func (c *PostgresClient) GetPendingOutboxEvents(ctx context.Context, limit int) ([]OutboxEvent, error) {
	query := `
		SELECT 
			id,
			event_data,
			routing_key,
			created_at
		FROM outbox_events
		WHERE status = 'pending'
		AND (next_retry_at IS NULL OR next_retry_at <= NOW())
		ORDER BY created_at ASC
		LIMIT $1
	`

	rows, err := c.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query pending events: %w", err)
	}
	defer rows.Close()

	var events []OutboxEvent
	for rows.Next() {
		var event OutboxEvent
		err := rows.Scan(
			&event.ID,
			&event.EventData,
			&event.RoutingKey,
			&event.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		// Set status based on current row data
		event.Status = "pending"
		events = append(events, event)
	}

	return events, nil
}

// MarkEventPublished marks an outbox event as published
func (c *PostgresClient) MarkEventPublished(ctx context.Context, outboxID, errorMessage string) error {
	query := `
		SELECT mark_outbox_published($1::uuid, $2)
	`

	_, err := c.db.ExecContext(ctx, query, outboxID, errorMessage)
	if err != nil {
		return fmt.Errorf("failed to mark event as published: %w", err)
	}

	return nil
}

// GetOutboxEventCount returns the total number of outbox events
func (c *PostgresClient) GetOutboxEventCount(ctx context.Context) (int64, error) {
	query := `SELECT COUNT(*) FROM outbox_events`

	var count int64
	err := c.db.QueryRowContext(ctx, query).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to get event count: %w", err)
	}

	return count, nil
}

// IsHealthy checks if the database connection is healthy
func (c *PostgresClient) IsHealthy(ctx context.Context) bool {
	if c == nil || c.db == nil {
		return false
	}

	// Simple ping test
	err := c.db.PingContext(ctx)
	return err == nil
}

// GetDatabaseInfo returns information about the database
func (c *PostgresClient) GetDatabaseInfo(ctx context.Context) (*DatabaseInfo, error) {
	query := `
		SELECT 
			current_database() as database_name,
			version() as version,
			current_timestamp as current_time
	`

	var info DatabaseInfo
	err := c.db.QueryRowContext(ctx, query).Scan(
		&info.DatabaseName,
		&info.Version,
		&info.CurrentTime,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get database info: %w", err)
	}

	return &info, nil
}

// OutboxHealth represents the health metrics from outbox_health view
type OutboxHealth struct {
	TotalEvents           int64   `json:"total_events"`
	Pending               int64   `json:"pending"`
	Published             int64   `json:"published"`
	Failed                int64   `json:"failed"`
	PublishedLastHour     int64   `json:"published_last_hour"`
	AvgPublishTimeSeconds float64 `json:"avg_publish_time_seconds"`
}

// OutboxEvent represents an outbox event
type OutboxEvent struct {
	ID         string `json:"id"`
	EventData  string `json:"event_data"`
	Status     string `json:"status"`
	RoutingKey string `json:"routing_key"`
	CreatedAt  string `json:"created_at"`
	Source     string `json:"source,omitempty"`
}

// ParseEventData parses the JSON event data into a map
func (e *OutboxEvent) ParseEventData() (map[string]interface{}, error) {
	var data map[string]interface{}
	err := json.Unmarshal([]byte(e.EventData), &data)
	return data, err
}

// DatabaseInfo represents database information
type DatabaseInfo struct {
	DatabaseName string    `json:"database_name"`
	Version      string    `json:"version"`
	CurrentTime  time.Time `json:"current_time"`
}

// MonitorOutbox monitors outbox health and logs metrics
func (c *PostgresClient) MonitorOutbox(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Outbox monitoring stopped")
			return
		case <-ticker.C:
			health, err := c.GetOutboxHealth(ctx)
			if err != nil {
				log.Printf("Failed to get outbox health: %v", err)
				continue
			}

			log.Printf("Outbox Health - Pending: %d, Published: %d, Failed: %d",
				health.Pending, health.Published, health.Failed)

			// Alert if there are too many failed events
			if health.Failed > 100 {
				log.Printf("WARNING: High number of failed outbox events: %d", health.Failed)
			}

			// Alert if there are too many pending events
			if health.Pending > 1000 {
				log.Printf("WARNING: High number of pending outbox events: %d", health.Pending)
			}
		}
	}
}
