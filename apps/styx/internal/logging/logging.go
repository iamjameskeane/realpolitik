package logging

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"time"
)

type Logger struct {
	logger *slog.Logger
}

type LogLevel string

const (
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
)

func NewLogger() Logger {
	level := getLogLevel()
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	}))

	return Logger{logger: logger}
}

func getLogLevel() slog.Level {
	levelStr := os.Getenv("LOG_LEVEL")
	if levelStr == "" {
		levelStr = "info"
	}

	switch levelStr {
	case "debug":
		return slog.LevelDebug
	case "info":
		return slog.LevelInfo
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func (l Logger) Debug(msg string, args ...interface{}) {
	l.logger.Debug(msg, args...)
}

func (l Logger) Info(msg string, args ...interface{}) {
	l.logger.Info(msg, args...)
}

func (l Logger) Warn(msg string, args ...interface{}) {
	l.logger.Warn(msg, args...)
}

func (l Logger) Error(msg string, args ...interface{}) {
	l.logger.Error(msg, args...)
}

func (l Logger) WithContext(ctx context.Context) Logger {
	// Slog doesn't have WithContext, so we'll just return the same logger
	return l
}

func (l Logger) With(args ...interface{}) Logger {
	return Logger{logger: l.logger.With(args...)}
}

// Helper functions for structured logging
func (l Logger) Request(r *http.Request) Logger {
	return l.With(
		"method", r.Method,
		"path", r.URL.Path,
		"user_agent", r.UserAgent(),
		"remote_addr", r.RemoteAddr,
	)
}

func (l Logger) Response(statusCode int, size int64, duration time.Duration) Logger {
	return l.With(
		"status_code", statusCode,
		"response_size", size,
		"duration_ms", duration.Milliseconds(),
	)
}

// Convert time.Duration to int64 for logging
