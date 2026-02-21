package health

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/realpolitik/realpolitik/apps/styx/internal/config"
)

type HealthStatus struct {
	Overall   string                   `json:"overall"`
	Timestamp time.Time                `json:"timestamp"`
	Services  map[string]ServiceHealth `json:"services"`
}

type ServiceHealth struct {
	Status    string    `json:"status"`
	Message   string    `json:"message,omitempty"`
	LastCheck time.Time `json:"last_check"`
	Latency   int64     `json:"latency_ms,omitempty"`
}

type Checker struct {
	config   *config.Config
	services map[string]ServiceInfo
	mutex    sync.RWMutex
	status   HealthStatus
}

type ServiceInfo struct {
	Name    string
	URL     string
	Timeout time.Duration
}

func NewChecker() *Checker {
	c := &Checker{
		services: make(map[string]ServiceInfo),
		status: HealthStatus{
			Services: make(map[string]ServiceHealth),
		},
	}

	return c
}

func (c *Checker) RegisterService(name, url string, timeout time.Duration) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.services[name] = ServiceInfo{
		Name:    name,
		URL:     url,
		Timeout: timeout,
	}
}

func (c *Checker) CheckService(name string) error {
	c.mutex.RLock()
	service, exists := c.services[name]
	c.mutex.RUnlock()

	if !exists {
		return nil
	}

	client := http.Client{
		Timeout: service.Timeout,
	}

	start := time.Now()
	resp, err := client.Get(service.URL + "/health")
	latency := time.Since(start).Milliseconds()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	if err != nil {
		c.status.Services[name] = ServiceHealth{
			Status:    "unhealthy",
			Message:   err.Error(),
			LastCheck: time.Now(),
			Latency:   latency,
		}
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		c.status.Services[name] = ServiceHealth{
			Status:    "healthy",
			LastCheck: time.Now(),
			Latency:   latency,
		}
	} else {
		c.status.Services[name] = ServiceHealth{
			Status:    "unhealthy",
			Message:   "non-200 status code",
			LastCheck: time.Now(),
			Latency:   latency,
		}
	}

	return nil
}

func (c *Checker) GetStatus() HealthStatus {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	// Update timestamp
	status := c.status
	status.Timestamp = time.Now()

	// Determine overall health
	overall := "healthy"
	for name, service := range status.Services {
		if service.Status != "healthy" {
			overall = "unhealthy"
			break
		}
		if name == "" {
			overall = "unknown"
			break
		}
	}

	status.Overall = overall
	return status
}

func (c *Checker) IsReady() bool {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	// Consider ready if at least some services are healthy
	healthyCount := 0
	totalServices := len(c.services)

	for _, service := range c.status.Services {
		if service.Status == "healthy" {
			healthyCount++
		}
	}

	// Ready if at least 50% of services are healthy
	return totalServices == 0 || healthyCount >= (totalServices+1)/2
}

func (c *Checker) ToJSON() []byte {
	status := c.GetStatus()
	data, _ := json.MarshalIndent(status, "", "  ")
	return data
}
