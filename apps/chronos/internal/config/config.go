package config

import (
	"fmt"
	"net"

	"github.com/joho/godotenv"
	"github.com/spf13/viper"
)

type Config struct {
	// Database
	DatabaseURL  string `mapstructure:"DATABASE_URL"`
	DatabaseHost string `mapstructure:"DATABASE_HOST"`
	DatabasePort string `mapstructure:"DATABASE_PORT"`
	DatabaseUser string `mapstructure:"DATABASE_USER"`
	DatabasePass string `mapstructure:"DATABASE_PASSWORD"`
	DatabaseName string `mapstructure:"DATABASE_NAME"`

	// RabbitMQ
	RabbitMQURL   string `mapstructure:"RABBITMQ_URL"`
	RabbitMQHost  string `mapstructure:"RABBITMQ_HOST"`
	RabbitMQPort  string `mapstructure:"RABBITMQ_PORT"`
	RabbitMQUser  string `mapstructure:"RABBITMQ_USER"`
	RabbitMQPass  string `mapstructure:"RABBITMQ_PASSWORD"`
	RabbitMQVHost string `mapstructure:"RABBITMQ_VHOST"`

	// Debezium
	DebeziumServerURL     string `mapstructure:"DEBEZIUM_SERVER_URL"`
	DebeziumConnectorName string `mapstructure:"DEBEZIUM_CONNECTOR_NAME"`

	// Service
	ServicePort string `mapstructure:"SERVICE_PORT"`
	LogLevel    string `mapstructure:"LOG_LEVEL"`

	// Health & Monitoring
	HealthCheckInterval string `mapstructure:"HEALTH_CHECK_INTERVAL"`
	MetricsEnabled      bool   `mapstructure:"METRICS_ENABLED"`
}

func LoadConfig() (*Config, error) {
	// Load from .env file
	_ = godotenv.Load()

	// Load from environment variables with explicit binding
	bindEnvVars()

	var config Config
	err := viper.Unmarshal(&config)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Apply defaults
	applyDefaults(&config)

	// Validate
	if err := config.IsValid(); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return &config, nil
}

func bindEnvVars() {
	// Database
	viper.BindEnv("DATABASE_URL")
	viper.BindEnv("DATABASE_HOST")
	viper.BindEnv("DATABASE_PORT")
	viper.BindEnv("DATABASE_USER")
	viper.BindEnv("DATABASE_PASSWORD")
	viper.BindEnv("DATABASE_NAME")

	// RabbitMQ
	viper.BindEnv("RABBITMQ_URL")
	viper.BindEnv("RABBITMQ_HOST")
	viper.BindEnv("RABBITMQ_PORT")
	viper.BindEnv("RABBITMQ_USER")
	viper.BindEnv("RABBITMQ_PASSWORD")
	viper.BindEnv("RABBITMQ_VHOST")

	// Debezium
	viper.BindEnv("DEBEZIUM_SERVER_URL")
	viper.BindEnv("DEBEZIUM_CONNECTOR_NAME")

	// Service
	viper.BindEnv("SERVICE_PORT")
	viper.BindEnv("LOG_LEVEL")

	// Health & Monitoring
	viper.BindEnv("HEALTH_CHECK_INTERVAL")
	viper.BindEnv("METRICS_ENABLED")
}

func applyDefaults(config *Config) {
	if config.DatabaseHost == "" {
		config.DatabaseHost = "localhost"
	}
	if config.DatabasePort == "" {
		config.DatabasePort = "5432"
	}
	if config.DatabaseUser == "" {
		config.DatabaseUser = "postgres"
	}
	if config.DatabaseName == "" {
		config.DatabaseName = "realpolitik"
	}
	if config.RabbitMQPort == "" {
		config.RabbitMQPort = "5672"
	}
	if config.RabbitMQUser == "" {
		config.RabbitMQUser = "guest"
	}
	if config.RabbitMQVHost == "" {
		config.RabbitMQVHost = "/"
	}
	if config.ServicePort == "" {
		config.ServicePort = "8080"
	}
	if config.LogLevel == "" {
		config.LogLevel = "info"
	}
	if config.HealthCheckInterval == "" {
		config.HealthCheckInterval = "30s"
	}
}

func (c *Config) IsValid() error {
	// Check database configuration - be stricter about requiring at least one method
	if c.DatabaseURL == "" && c.DatabaseHost == "" && c.DatabaseUser == "" {
		return fmt.Errorf("database configuration is required (provide DATABASE_URL or at least DATABASE_HOST and DATABASE_USER)")
	}

	// Check RabbitMQ configuration - be stricter about requiring at least one method
	if c.RabbitMQURL == "" && c.RabbitMQHost == "" && c.RabbitMQUser == "" {
		return fmt.Errorf("RabbitMQ configuration is required (provide RABBITMQ_URL or at least RABBITMQ_HOST and RABBITMQ_USER)")
	}

	// Validate port if specified
	if c.ServicePort != "" {
		if _, err := net.LookupPort("tcp", c.ServicePort); err != nil {
			return fmt.Errorf("invalid service port: %w", err)
		}
	}

	return nil
}

// GetDatabaseConnectionString returns the PostgreSQL connection string
func (c *Config) GetDatabaseConnectionString() string {
	if c.DatabaseURL != "" {
		return c.DatabaseURL
	}
	return fmt.Sprintf("postgresql://%s:%s@%s:%s/%s",
		c.DatabaseUser, c.DatabasePass, c.DatabaseHost, c.DatabasePort, c.DatabaseName)
}

// GetRabbitMQConnectionString returns the RabbitMQ connection string
func (c *Config) GetRabbitMQConnectionString() string {
	if c.RabbitMQURL != "" {
		return c.RabbitMQURL
	}
	return fmt.Sprintf("amqp://%s:%s@%s:%s/%s",
		c.RabbitMQUser, c.RabbitMQPass, c.RabbitMQHost, c.RabbitMQPort, c.RabbitMQVHost)
}
