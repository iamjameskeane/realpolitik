package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Environment string
	Port        int

	// Service endpoints
	DelphiURL string
	HermesURL string
	PythiaURL string

	// Health check settings
	HealthCheckInterval time.Duration
	HealthCheckTimeout  time.Duration

	// Rate limiting
	RateLimitEnabled bool
	RateLimitRPS     int

	// JWT settings
	JWTEnabled  bool
	JWTSecret   string
	JWTAudience string

	// Redis for caching/rate limiting
	RedisURL string

	// Logging
	LogLevel string
}

func Load() (*Config, error) {
	cfg := &Config{
		Environment: getEnv("ENVIRONMENT", "development"),
		Port:        getEnvAsInt("PORT", 8080),

		DelphiURL: getEnv("DELPHI_URL", "http://delphi:8000"),
		HermesURL: getEnv("HERMES_URL", "http://hermes:8002"),
		PythiaURL: getEnv("PYTHIA_URL", "http://pythia:8001"),

		HealthCheckInterval: getEnvAsDuration("HEALTH_CHECK_INTERVAL", 30*time.Second),
		HealthCheckTimeout:  getEnvAsDuration("HEALTH_CHECK_TIMEOUT", 5*time.Second),

		RateLimitEnabled: getEnvAsBool("RATE_LIMIT_ENABLED", false),
		RateLimitRPS:     getEnvAsInt("RATE_LIMIT_RPS", 100),

		JWTEnabled:  getEnvAsBool("JWT_ENABLED", false),
		JWTSecret:   getEnv("JWT_SECRET", ""),
		JWTAudience: getEnv("JWT_AUDIENCE", "realpolitik"),

		RedisURL: getEnv("REDIS_URL", "redis://lethe:6379"),

		LogLevel: getEnv("LOG_LEVEL", "info"),
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value, exists := os.LookupEnv(key); exists {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
