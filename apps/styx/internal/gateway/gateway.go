package gateway

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/realpolitik/realpolitik/apps/styx/internal/config"
	"github.com/realpolitik/realpolitik/apps/styx/internal/health"
	"github.com/realpolitik/realpolitik/apps/styx/internal/logging"
)

type Gateway struct {
	config *config.Config
	router *mux.Router
	logger logging.Logger
	health *health.Checker

	// Service backends
	delphiProxy *httputil.ReverseProxy
	hermesProxy *httputil.ReverseProxy
	pythiaProxy *httputil.ReverseProxy

	// Circuit breakers and health tracking
	lastSeen map[string]time.Time
}

func NewGateway(cfg *config.Config, healthChecker *health.Checker, logger logging.Logger) (*Gateway, error) {
	g := &Gateway{
		config:   cfg,
		router:   mux.NewRouter(),
		logger:   logger,
		health:   healthChecker,
		lastSeen: make(map[string]time.Time),
	}

	// Parse service URLs
	delphiURL, err := url.Parse(cfg.DelphiURL)
	if err != nil {
		return nil, err
	}

	hermesURL, err := url.Parse(cfg.HermesURL)
	if err != nil {
		return nil, err
	}

	pythiaURL, err := url.Parse(cfg.PythiaURL)
	if err != nil {
		return nil, err
	}

	// Create reverse proxies
	g.delphiProxy = httputil.NewSingleHostReverseProxy(delphiURL)
	g.hermesProxy = httputil.NewSingleHostReverseProxy(hermesURL)
	g.pythiaProxy = httputil.NewSingleHostReverseProxy(pythiaURL)

	// Setup request handlers
	g.setupRoutes()

	return g, nil
}

func (g *Gateway) setupRoutes() {
	// Health check endpoints
	g.router.HandleFunc("/health", g.healthHandler).Methods("GET")
	g.router.HandleFunc("/health/ready", g.readinessHandler).Methods("GET")

	// API routes - route to Delphi
	api := g.router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/v1/", g.proxyToDelphi)
	api.HandleFunc("/v1/{path:.*}", g.proxyToDelphi)

	// MCP routes - route to Hermes
	mcp := g.router.PathPrefix("/mcp").Subrouter()
	mcp.HandleFunc("/v1/", g.proxyToHermes)
	mcp.HandleFunc("/v1/{path:.*}", g.proxyToHermes)

	// WebSocket routes - route to Pythia
	ws := g.router.PathPrefix("/ws").Subrouter()
	ws.HandleFunc("/chat/", g.proxyToPythia)
	ws.HandleFunc("/chat/{path:.*}", g.proxyToPythia)

	// Root routing
	g.router.HandleFunc("/", g.rootHandler)
	g.router.HandleFunc("/{path:.*}", g.proxyToDelphi) // Default fallback
}

func (g *Gateway) proxyToDelphi(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	path := vars["path"]
	if path == "" {
		path = "root"
	}
	g.logger.Debug("routing to delphi", "path", path, "method", r.Method)
	g.delphiProxy.ServeHTTP(w, r)
}

func (g *Gateway) proxyToHermes(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	path := vars["path"]
	if path == "" {
		path = "root"
	}
	g.logger.Debug("routing to hermes", "path", path, "method", r.Method)
	g.hermesProxy.ServeHTTP(w, r)
}

func (g *Gateway) proxyToPythia(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	path := vars["path"]
	if path == "" {
		path = "root"
	}
	g.logger.Debug("routing to pythia", "path", path, "method", r.Method)
	g.pythiaProxy.ServeHTTP(w, r)
}

func (g *Gateway) healthHandler(w http.ResponseWriter, r *http.Request) {
	status := g.health.GetStatus()
	w.Header().Set("Content-Type", "application/json")

	if status.Overall == "healthy" {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
	}

	w.Write(g.health.ToJSON())
}

func (g *Gateway) readinessHandler(w http.ResponseWriter, r *http.Request) {
	// Check if backend services are available
	ready := g.health.IsReady()

	w.Header().Set("Content-Type", "application/json")
	if ready {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ready"}`))
	} else {
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"status": "not ready"}`))
	}
}

func (g *Gateway) rootHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{
		"service": "styx-gateway",
		"version": "0.1.0",
		"status": "running",
		"routes": {
			"api": "/api/v1/* → delphi",
			"mcp": "/mcp/v1/* → hermes", 
			"ws": "/ws/chat/* → pythia"
		}
	}`))
}

func (g *Gateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	g.router.ServeHTTP(w, r)
}

// GetConfig returns the gateway configuration
func (g *Gateway) GetConfig() *config.Config {
	return g.config
}

// Utility functions for path manipulation
func extractPath(path string) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) > 0 {
		return strings.Join(parts, "/")
	}
	return ""
}
