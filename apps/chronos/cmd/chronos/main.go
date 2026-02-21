package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/realpolitik/chronos/internal/config"
	"github.com/realpolitik/chronos/internal/service"
)

func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Create Chronos server
	server, err := service.NewChronosServer(cfg)
	if err != nil {
		log.Fatalf("Failed to create Chronos server: %v", err)
	}
	defer server.Close()

	// Setup graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	go func() {
		defer cancel()
		<-shutdown
		log.Println("Received shutdown signal, starting graceful shutdown...")

		// Give the server some time to finish processing requests
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer shutdownCancel()

		<-shutdownCtx.Done()
		log.Println("Graceful shutdown completed")
	}()

	// Start server in a goroutine
	serverStopped := make(chan error, 1)
	go func() {
		log.Printf("Starting Chronos server on port %s", cfg.ServicePort)
		err := server.Start()
		if err != nil && err != http.ErrServerClosed {
			serverStopped <- err
		}
	}()

	// Wait for either server to stop or shutdown signal
	select {
	case err := <-serverStopped:
		log.Fatalf("Server error: %v", err)
	case <-ctx.Done():
		log.Println("Chronos server is shutting down...")
	}
}
