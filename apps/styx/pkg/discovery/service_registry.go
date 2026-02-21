package discovery

import (
	"fmt"
	"net/url"
	"time"
)

type Service struct {
	Name      string
	URL       string
	Healthy   bool
	LastCheck time.Time
}

type Registry struct {
	services map[string]*Service
}

func NewRegistry() *Registry {
	return &Registry{
		services: make(map[string]*Service),
	}
}

func (r *Registry) Register(name, urlStr string) error {
	u, err := url.Parse(urlStr)
	if err != nil {
		return fmt.Errorf("invalid URL for service %s: %w", name, err)
	}

	r.services[name] = &Service{
		Name:      name,
		URL:       u.String(),
		Healthy:   false,
		LastCheck: time.Now(),
	}

	return nil
}

func (r *Registry) Get(name string) (*Service, bool) {
	service, exists := r.services[name]
	return service, exists
}

func (r *Registry) List() []*Service {
	services := make([]*Service, 0, len(r.services))
	for _, service := range r.services {
		services = append(services, service)
	}
	return services
}

func (r *Registry) IsHealthy(name string) bool {
	service, exists := r.services[name]
	return exists && service.Healthy
}

func (r *Registry) UpdateHealth(name string, healthy bool) {
	if service, exists := r.services[name]; exists {
		service.Healthy = healthy
		service.LastCheck = time.Now()
	}
}
