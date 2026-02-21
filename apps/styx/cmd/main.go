package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/realpolitik/realpolitik/apps/styx/internal/config"
	"github.com/realpolitik/realpolitik/apps/styx/internal/gateway"
	"github.com/realpolitik/realpolitik/apps/styx/internal/health"
	"github.com/realpolitik/realpolitik/apps/styx/internal/logging"
)

func main() {
	// Initialize structured logger
	logger := logging.NewLogger()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	logger.Info("starting styx gateway", "version", "0.1.0", "environment", cfg.Environment)

	// Initialize health checker
	healthChecker := health.NewChecker()

	// Initialize gateway with service discovery
	gw, err := gateway.NewGateway(cfg, healthChecker, logger)
	if err != nil {
		logger.Error("failed to create gateway", "error", err)
		os.Exit(1)
	}

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      gw,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Setup graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		logger.Info("shutting down styx gateway gracefully...")

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			logger.Error("server forced to shutdown", "error", err)
		}
	}()

	// Start server
	logger.Info("styx gateway listening", "port", cfg.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("server failed to start", "error", err)
		os.Exit(1)
	}

	logger.Info("styx gateway stopped")
}
