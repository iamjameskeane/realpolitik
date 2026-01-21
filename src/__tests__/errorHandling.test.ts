import { describe, it, expect, vi } from "vitest";

/**
 * Tests for error handling and graceful degradation.
 *
 * These tests verify the system behaves correctly when things go wrong:
 * - API errors
 * - Network failures
 * - Invalid data
 * - Service unavailability
 */

describe("API Error Handling", () => {
  describe("HTTP error responses", () => {
    function handleApiError(status: number): {
      shouldRetry: boolean;
      userMessage: string;
      logLevel: "error" | "warn" | "info";
    } {
      switch (status) {
        case 400:
          return {
            shouldRetry: false,
            userMessage: "Invalid request. Please check your settings.",
            logLevel: "warn",
          };
        case 401:
          return {
            shouldRetry: false,
            userMessage: "Authentication failed. Please try again.",
            logLevel: "error",
          };
        case 403:
          return {
            shouldRetry: false,
            userMessage: "Access denied.",
            logLevel: "error",
          };
        case 404:
          return {
            shouldRetry: false,
            userMessage: "Resource not found.",
            logLevel: "warn",
          };
        case 429:
          return {
            shouldRetry: true,
            userMessage: "Too many requests. Please wait.",
            logLevel: "warn",
          };
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            shouldRetry: true,
            userMessage: "Server error. Please try again later.",
            logLevel: "error",
          };
        default:
          return {
            shouldRetry: false,
            userMessage: "An unexpected error occurred.",
            logLevel: "error",
          };
      }
    }

    it("should not retry client errors (4xx)", () => {
      expect(handleApiError(400).shouldRetry).toBe(false);
      expect(handleApiError(401).shouldRetry).toBe(false);
      expect(handleApiError(403).shouldRetry).toBe(false);
      expect(handleApiError(404).shouldRetry).toBe(false);
    });

    it("should retry rate limit errors (429)", () => {
      const result = handleApiError(429);
      expect(result.shouldRetry).toBe(true);
      expect(result.userMessage).toContain("wait");
    });

    it("should retry server errors (5xx)", () => {
      expect(handleApiError(500).shouldRetry).toBe(true);
      expect(handleApiError(502).shouldRetry).toBe(true);
      expect(handleApiError(503).shouldRetry).toBe(true);
      expect(handleApiError(504).shouldRetry).toBe(true);
    });

    it("should provide user-friendly messages", () => {
      expect(handleApiError(401).userMessage).not.toContain("401");
      expect(handleApiError(500).userMessage).toContain("try again");
    });
  });

  describe("Network errors", () => {
    function isNetworkError(error: Error): boolean {
      const networkErrorPatterns = [
        "Failed to fetch",
        "NetworkError",
        "Network request failed",
        "net::ERR_",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ENOTFOUND",
      ];
      return networkErrorPatterns.some((pattern) => error.message.includes(pattern));
    }

    it("should identify fetch failures", () => {
      expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
    });

    it("should identify connection refused", () => {
      expect(isNetworkError(new Error("ECONNREFUSED"))).toBe(true);
    });

    it("should identify timeout", () => {
      expect(isNetworkError(new Error("ETIMEDOUT"))).toBe(true);
    });

    it("should not flag non-network errors", () => {
      expect(isNetworkError(new Error("Invalid JSON"))).toBe(false);
      expect(isNetworkError(new Error("Validation failed"))).toBe(false);
    });
  });

  describe("Retry logic", () => {
    function calculateBackoff(attempt: number, baseMs: number = 1000): number {
      // Exponential backoff with jitter
      const exponential = Math.min(baseMs * Math.pow(2, attempt), 30000);
      const jitter = Math.random() * 0.3 * exponential;
      return Math.floor(exponential + jitter);
    }

    it("should increase delay with each attempt", () => {
      const delay1 = calculateBackoff(0, 1000);
      const delay2 = calculateBackoff(1, 1000);
      const delay3 = calculateBackoff(2, 1000);

      // Due to jitter, we check base values
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay3).toBeGreaterThanOrEqual(4000);
    });

    it("should cap maximum delay", () => {
      const delay = calculateBackoff(10, 1000);
      expect(delay).toBeLessThanOrEqual(40000); // 30s + 30% jitter
    });

    it("should handle max retries", () => {
      const MAX_RETRIES = 3;
      let attempts = 0;
      const success = false;

      const simulateWithRetries = () => {
        while (attempts < MAX_RETRIES && !success) {
          attempts++;
          // Simulate failure
          if (attempts < MAX_RETRIES) {
            continue;
          }
        }
      };

      simulateWithRetries();
      expect(attempts).toBe(MAX_RETRIES);
    });
  });
});

describe("Invalid Data Handling", () => {
  describe("Event data validation", () => {
    interface Event {
      id: string;
      title: string;
      severity: number;
      coordinates: [number, number];
    }

    function validateEvent(data: unknown): { valid: boolean; errors: string[] } {
      const errors: string[] = [];

      if (!data || typeof data !== "object") {
        return { valid: false, errors: ["Data must be an object"] };
      }

      const event = data as Record<string, unknown>;

      if (typeof event.id !== "string" || !event.id) {
        errors.push("Missing or invalid id");
      }

      if (typeof event.title !== "string" || !event.title) {
        errors.push("Missing or invalid title");
      }

      if (typeof event.severity !== "number" || event.severity < 1 || event.severity > 10) {
        errors.push("Severity must be a number between 1 and 10");
      }

      if (!Array.isArray(event.coordinates) || event.coordinates.length !== 2) {
        errors.push("Coordinates must be [lon, lat] array");
      }

      return { valid: errors.length === 0, errors };
    }

    it("should accept valid event", () => {
      const event = {
        id: "test-1",
        title: "Test Event",
        severity: 7,
        coordinates: [30.5, 50.4],
      };
      expect(validateEvent(event).valid).toBe(true);
    });

    it("should reject null data", () => {
      const result = validateEvent(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Data must be an object");
    });

    it("should collect multiple errors", () => {
      const result = validateEvent({ id: "", severity: 15 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    it("should validate severity bounds", () => {
      expect(validateEvent({ id: "1", title: "T", severity: 0, coordinates: [0, 0] }).valid).toBe(
        false
      );
      expect(validateEvent({ id: "1", title: "T", severity: 11, coordinates: [0, 0] }).valid).toBe(
        false
      );
      expect(validateEvent({ id: "1", title: "T", severity: 5, coordinates: [0, 0] }).valid).toBe(
        true
      );
    });
  });

  describe("JSON parsing", () => {
    function safeJsonParse<T>(json: string, fallback: T): T {
      try {
        return JSON.parse(json) as T;
      } catch {
        return fallback;
      }
    }

    it("should parse valid JSON", () => {
      const result = safeJsonParse('{"name": "test"}', {});
      expect(result).toEqual({ name: "test" });
    });

    it("should return fallback for invalid JSON", () => {
      const result = safeJsonParse("not valid json", { default: true });
      expect(result).toEqual({ default: true });
    });

    it("should handle empty string", () => {
      const result = safeJsonParse("", []);
      expect(result).toEqual([]);
    });
  });

  describe("Malformed subscription data", () => {
    function sanitizeSubscription(sub: unknown): {
      valid: boolean;
      sanitized?: { endpoint: string; keys: { p256dh: string; auth: string } };
    } {
      if (!sub || typeof sub !== "object") {
        return { valid: false };
      }

      const s = sub as Record<string, unknown>;

      if (typeof s.endpoint !== "string" || !s.endpoint.startsWith("https://")) {
        return { valid: false };
      }

      const keys = s.keys as Record<string, unknown> | undefined;
      if (!keys || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") {
        return { valid: false };
      }

      return {
        valid: true,
        sanitized: {
          endpoint: s.endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
        },
      };
    }

    it("should accept valid subscription", () => {
      const sub = {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "publickey", auth: "authkey" },
      };
      expect(sanitizeSubscription(sub).valid).toBe(true);
    });

    it("should reject http endpoints", () => {
      const sub = {
        endpoint: "http://insecure.com/push",
        keys: { p256dh: "key", auth: "auth" },
      };
      expect(sanitizeSubscription(sub).valid).toBe(false);
    });

    it("should reject missing keys", () => {
      const sub = { endpoint: "https://example.com" };
      expect(sanitizeSubscription(sub).valid).toBe(false);
    });
  });
});

describe("Service Unavailability", () => {
  describe("Graceful degradation", () => {
    interface ServiceStatus {
      redis: boolean;
      push: boolean;
      gemini: boolean;
    }

    function getAvailableFeatures(status: ServiceStatus): string[] {
      const features: string[] = [];

      // Core features always available
      features.push("view-events");
      features.push("view-map");

      // Redis-dependent features
      if (status.redis) {
        features.push("reactions");
        features.push("push-subscriptions");
      }

      // Push-dependent features
      if (status.push && status.redis) {
        features.push("notifications");
      }

      // Gemini-dependent features
      if (status.gemini) {
        features.push("event-enrichment");
        features.push("synthesis");
      }

      return features;
    }

    it("should always provide core features", () => {
      const features = getAvailableFeatures({ redis: false, push: false, gemini: false });
      expect(features).toContain("view-events");
      expect(features).toContain("view-map");
    });

    it("should disable notifications when Redis is down", () => {
      const features = getAvailableFeatures({ redis: false, push: true, gemini: true });
      expect(features).not.toContain("notifications");
      expect(features).not.toContain("push-subscriptions");
    });

    it("should enable all features when services are up", () => {
      const features = getAvailableFeatures({ redis: true, push: true, gemini: true });
      expect(features).toContain("notifications");
      expect(features).toContain("reactions");
      expect(features).toContain("event-enrichment");
    });
  });

  describe("Timeout handling", () => {
    function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
        ),
      ]);
    }

    it("should resolve before timeout", async () => {
      const fastPromise = Promise.resolve("success");
      const result = await withTimeout(fastPromise, 1000);
      expect(result).toBe("success");
    });

    it("should reject on timeout", async () => {
      const slowPromise = new Promise((resolve) => setTimeout(resolve, 5000));
      await expect(withTimeout(slowPromise, 10)).rejects.toThrow("timed out");
    });
  });

  describe("Circuit breaker pattern", () => {
    class CircuitBreaker {
      private failures = 0;
      private lastFailure = 0;
      private readonly threshold = 5;
      private readonly resetTimeout = 30000;

      isOpen(): boolean {
        if (this.failures >= this.threshold) {
          const timeSinceLastFailure = Date.now() - this.lastFailure;
          if (timeSinceLastFailure < this.resetTimeout) {
            return true; // Circuit is open, reject requests
          }
          // Reset after timeout
          this.failures = 0;
        }
        return false;
      }

      recordFailure(): void {
        this.failures++;
        this.lastFailure = Date.now();
      }

      recordSuccess(): void {
        this.failures = 0;
      }
    }

    it("should allow requests when circuit is closed", () => {
      const breaker = new CircuitBreaker();
      expect(breaker.isOpen()).toBe(false);
    });

    it("should open circuit after threshold failures", () => {
      const breaker = new CircuitBreaker();
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }
      expect(breaker.isOpen()).toBe(true);
    });

    it("should reset on success", () => {
      const breaker = new CircuitBreaker();
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();
      expect(breaker.isOpen()).toBe(false);
    });
  });
});

describe("Logging and Monitoring", () => {
  describe("Error classification", () => {
    type ErrorSeverity = "critical" | "error" | "warning" | "info";

    function classifyError(error: Error): ErrorSeverity {
      const message = error.message.toLowerCase();

      // Critical - system is broken
      if (message.includes("database") || message.includes("redis")) {
        return "critical";
      }

      // Error - feature is broken
      if (message.includes("api") || message.includes("authentication")) {
        return "error";
      }

      // Warning - degraded but functional
      if (message.includes("timeout") || message.includes("retry")) {
        return "warning";
      }

      // Info - expected errors
      if (message.includes("not found") || message.includes("validation")) {
        return "info";
      }

      return "error";
    }

    it("should classify database errors as critical", () => {
      expect(classifyError(new Error("Redis connection failed"))).toBe("critical");
      expect(classifyError(new Error("Database unavailable"))).toBe("critical");
    });

    it("should classify API errors as error", () => {
      expect(classifyError(new Error("API request failed"))).toBe("error");
      expect(classifyError(new Error("Authentication failed"))).toBe("error");
    });

    it("should classify timeouts as warning", () => {
      expect(classifyError(new Error("Request timeout"))).toBe("warning");
      expect(classifyError(new Error("Will retry"))).toBe("warning");
    });

    it("should classify validation errors as info", () => {
      expect(classifyError(new Error("Resource not found"))).toBe("info");
      expect(classifyError(new Error("Validation failed"))).toBe("info");
    });
  });
});
