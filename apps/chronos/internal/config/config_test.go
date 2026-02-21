package config

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadConfig(t *testing.T) {
	// Setup environment variables
	os.Setenv("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
	os.Setenv("RABBITMQ_URL", "amqp://test:test@localhost:5672/")
	os.Setenv("DEBEZIUM_SERVER_URL", "http://localhost:8083")
	os.Setenv("DEBEZIUM_CONNECTOR_NAME", "chronos-connector")
	os.Setenv("SERVICE_PORT", "8080")
	os.Setenv("LOG_LEVEL", "debug")
	os.Setenv("METRICS_ENABLED", "true")

	// Load configuration
	config, err := LoadConfig()

	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, config, "config should not be nil")
	if config != nil {
		assert.Equal(t, "postgresql://test:test@localhost:5432/test", config.DatabaseURL)
		assert.Equal(t, "amqp://test:test@localhost:5672/", config.RabbitMQURL)
		assert.Equal(t, "http://localhost:8083", config.DebeziumServerURL)
		assert.Equal(t, "chronos-connector", config.DebeziumConnectorName)
		assert.Equal(t, "8080", config.ServicePort)
		assert.Equal(t, "debug", config.LogLevel)
		assert.True(t, config.MetricsEnabled)
	}
}

func TestLoadConfigDefaults(t *testing.T) {
	// Clear environment
	os.Unsetenv("DATABASE_URL")
	os.Unsetenv("RABBITMQ_URL")
	os.Unsetenv("SERVICE_PORT")

	// Load configuration with defaults
	config, err := LoadConfig()

	// Assertions
	assert.NoError(t, err)
	assert.NotNil(t, config, "config should not be nil")
	if config != nil {
		assert.Equal(t, "localhost", config.DatabaseHost)
		assert.Equal(t, "5672", config.RabbitMQPort)
		assert.Equal(t, "8080", config.ServicePort)
	}
}

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name    string
		envVars map[string]string
		wantErr bool
	}{
		{
			name: "valid configuration",
			envVars: map[string]string{
				"DATABASE_URL":        "postgresql://user:pass@localhost:5432/db",
				"RABBITMQ_URL":        "amqp://user:pass@localhost:5672/",
				"DEBEZIUM_SERVER_URL": "http://localhost:8083",
			},
			wantErr: false,
		},
		{
			name:    "completely empty configuration - defaults applied",
			envVars: map[string]string{},
			wantErr: false, // LoadConfig applies defaults
		},
		{
			name: "invalid port",
			envVars: map[string]string{
				"DATABASE_URL":        "postgresql://user:pass@localhost:5432/db",
				"RABBITMQ_URL":        "amqp://user:pass@localhost:5672/",
				"DEBEZIUM_SERVER_URL": "http://localhost:8083",
				"SERVICE_PORT":        "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear all relevant environment variables
			os.Unsetenv("DATABASE_URL")
			os.Unsetenv("DATABASE_HOST")
			os.Unsetenv("DATABASE_PORT")
			os.Unsetenv("DATABASE_USER")
			os.Unsetenv("DATABASE_PASSWORD")
			os.Unsetenv("DATABASE_NAME")
			os.Unsetenv("RABBITMQ_URL")
			os.Unsetenv("RABBITMQ_HOST")
			os.Unsetenv("RABBITMQ_PORT")
			os.Unsetenv("RABBITMQ_USER")
			os.Unsetenv("RABBITMQ_PASSWORD")
			os.Unsetenv("RABBITMQ_VHOST")
			os.Unsetenv("DEBEZIUM_SERVER_URL")
			os.Unsetenv("SERVICE_PORT")

			// Set test environment variables
			for k, v := range tt.envVars {
				os.Setenv(k, v)
			}

			// Load configuration
			config, err := LoadConfig()

			// Assertions
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.NotNil(t, config)
			}
		})
	}
}

func TestConfigIsValid(t *testing.T) {
	tests := []struct {
		name    string
		config  Config
		wantErr bool
	}{
		{
			name: "valid config",
			config: Config{
				DatabaseURL:           "postgresql://user:pass@localhost:5432/db",
				RabbitMQURL:           "amqp://user:pass@localhost:5672/",
				DebeziumServerURL:     "http://localhost:8083",
				DebeziumConnectorName: "test-connector",
				ServicePort:           "8080",
			},
			wantErr: false,
		},
		{
			name: "missing database configuration",
			config: Config{
				RabbitMQURL:       "amqp://user:pass@localhost:5672/",
				DebeziumServerURL: "http://localhost:8083",
				ServicePort:       "8080",
			},
			wantErr: true,
		},
		{
			name: "missing RabbitMQ configuration",
			config: Config{
				DatabaseURL:       "postgresql://user:pass@localhost:5432/db",
				DebeziumServerURL: "http://localhost:8083",
				ServicePort:       "8080",
			},
			wantErr: true,
		},
		{
			name: "invalid port",
			config: Config{
				DatabaseURL:       "postgresql://user:pass@localhost:5432/db",
				RabbitMQURL:       "amqp://user:pass@localhost:5672/",
				DebeziumServerURL: "http://localhost:8083",
				ServicePort:       "invalid",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.IsValid()
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGetDatabaseConnectionString(t *testing.T) {
	t.Run("returns URL when set", func(t *testing.T) {
		config := Config{
			DatabaseURL: "postgresql://user:pass@host:port/db",
		}
		expected := "postgresql://user:pass@host:port/db"
		assert.Equal(t, expected, config.GetDatabaseConnectionString())
	})

	t.Run("builds URL from components", func(t *testing.T) {
		config := Config{
			DatabaseUser: "user",
			DatabasePass: "pass",
			DatabaseHost: "host",
			DatabasePort: "5432",
			DatabaseName: "db",
		}
		expected := "postgresql://user:pass@host:5432/db"
		assert.Equal(t, expected, config.GetDatabaseConnectionString())
	})
}

func TestGetRabbitMQConnectionString(t *testing.T) {
	t.Run("returns URL when set", func(t *testing.T) {
		config := Config{
			RabbitMQURL: "amqp://user:pass@host:port/vhost",
		}
		expected := "amqp://user:pass@host:port/vhost"
		assert.Equal(t, expected, config.GetRabbitMQConnectionString())
	})

	t.Run("builds URL from components", func(t *testing.T) {
		config := Config{
			RabbitMQUser:  "user",
			RabbitMQPass:  "pass",
			RabbitMQHost:  "host",
			RabbitMQPort:  "5672",
			RabbitMQVHost: "/",
		}
		expected := "amqp://user:pass@host:5672//"
		assert.Equal(t, expected, config.GetRabbitMQConnectionString())
	})
}
