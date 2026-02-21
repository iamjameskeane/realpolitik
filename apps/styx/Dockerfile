# Use Go 1.21-alpine for smaller image size
FROM golang:1.21-alpine AS builder

# Install git and ca-certificates (needed for private repos and TLS)
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o styx cmd/main.go

# Use alpine image for runtime
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

# Create non-root user
RUN adduser -D -s /bin/sh styx

# Copy binary from builder stage
COPY --from=builder /app/styx /usr/local/bin/styx

# Switch to non-root user
USER styx

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the application
ENTRYPOINT ["styx"]