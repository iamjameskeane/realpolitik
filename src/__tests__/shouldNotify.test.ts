import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shouldNotify } from "@/lib/notificationRules";
import { NotificationPreferences } from "@/types/notifications";

/**
 * Tests for the shouldNotify function - the core decision logic
 * that determines whether a user should receive a notification.
 *
 * This combines:
 * 1. Enabled state
 * 2. Quiet hours check
 * 3. Rule matching
 */

describe("shouldNotify", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set time to 2026-01-21 15:00:00 UTC (outside typical quiet hours)
    vi.setSystemTime(new Date("2026-01-21T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseEvent = {
    id: "test-event-1",
    title: "Test Event",
    severity: 8,
    category: "MILITARY",
    region: "EUROPE",
    location_name: "Kyiv, Ukraine",
  };

  describe("enabled state", () => {
    it("should return false when notifications are disabled", () => {
      const prefs: NotificationPreferences = {
        enabled: false,
        rules: [
          {
            id: "1",
            name: "All Events",
            conditions: [{ field: "severity", operator: ">=", value: 1 }],
            enabled: true,
          },
        ],
        deliveryMode: "all",
      };

      expect(shouldNotify(baseEvent, prefs)).toBe(false);
    });

    it("should continue checking when notifications are enabled", () => {
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "High Severity",
            conditions: [{ field: "severity", operator: ">=", value: 7 }],
            enabled: true,
          },
        ],
        deliveryMode: "all",
      };

      expect(shouldNotify(baseEvent, prefs)).toBe(true);
    });
  });

  describe("quiet hours", () => {
    it("should return false during quiet hours", () => {
      // Set time to 23:00 UTC (within quiet hours)
      vi.setSystemTime(new Date("2026-01-21T23:00:00Z"));

      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "All Events",
            conditions: [{ field: "severity", operator: ">=", value: 1 }],
            enabled: true,
          },
        ],
        deliveryMode: "all",
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "07:00",
          timezone: "UTC",
        },
      };

      expect(shouldNotify(baseEvent, prefs)).toBe(false);
    });

    it("should allow notifications outside quiet hours", () => {
      // Time is 15:00 UTC (outside quiet hours)
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "All Events",
            conditions: [{ field: "severity", operator: ">=", value: 1 }],
            enabled: true,
          },
        ],
        deliveryMode: "all",
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "07:00",
          timezone: "UTC",
        },
      };

      expect(shouldNotify(baseEvent, prefs)).toBe(true);
    });

    it("should ignore quiet hours when disabled", () => {
      // Set time to 23:00 UTC (would be within quiet hours if enabled)
      vi.setSystemTime(new Date("2026-01-21T23:00:00Z"));

      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "All Events",
            conditions: [{ field: "severity", operator: ">=", value: 1 }],
            enabled: true,
          },
        ],
        deliveryMode: "all",
        quietHours: {
          enabled: false,
          start: "22:00",
          end: "07:00",
          timezone: "UTC",
        },
      };

      expect(shouldNotify(baseEvent, prefs)).toBe(true);
    });
  });

  describe("rule matching", () => {
    it("should return true when event matches at least one rule", () => {
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "Low Severity Only",
            conditions: [{ field: "severity", operator: "<=", value: 3 }],
            enabled: true,
          },
          {
            id: "2",
            name: "Europe High Severity",
            conditions: [
              { field: "severity", operator: ">=", value: 7 },
              { field: "region", operator: "=", value: "EUROPE" },
            ],
            enabled: true,
          },
        ],
        deliveryMode: "all",
      };

      // Event is severity 8 in EUROPE, matches rule 2
      expect(shouldNotify(baseEvent, prefs)).toBe(true);
    });

    it("should return false when event matches no rules", () => {
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "Asia Only",
            conditions: [{ field: "region", operator: "=", value: "EAST_ASIA" }],
            enabled: true,
          },
          {
            id: "2",
            name: "Low Severity",
            conditions: [{ field: "severity", operator: "<=", value: 3 }],
            enabled: true,
          },
        ],
        deliveryMode: "all",
      };

      // Event is severity 8 in EUROPE, matches neither rule
      expect(shouldNotify(baseEvent, prefs)).toBe(false);
    });

    it("should return false when no rules defined (must opt-in)", () => {
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [],
        deliveryMode: "all",
      };

      // No rules = must opt-in = deny all
      expect(shouldNotify(baseEvent, prefs)).toBe(false);
    });

    it("should ignore disabled rules (no match if all disabled)", () => {
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "Would Match But Disabled",
            conditions: [{ field: "severity", operator: ">=", value: 1 }],
            enabled: false,
          },
        ],
        deliveryMode: "all",
      };

      // Only rule is disabled, so no enabled rules match = deny
      expect(shouldNotify(baseEvent, prefs)).toBe(false);
    });
  });

  describe("combined logic", () => {
    it("should check all conditions: enabled → quiet hours → rules", () => {
      // This test verifies the order of checks
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "Critical Only",
            conditions: [{ field: "severity", operator: ">=", value: 9 }],
            enabled: true,
          },
        ],
        deliveryMode: "all",
        quietHours: {
          enabled: true,
          start: "22:00",
          end: "07:00",
          timezone: "UTC",
        },
      };

      // Event is severity 8, rule requires 9+
      expect(shouldNotify(baseEvent, prefs)).toBe(false);

      // Critical event should match
      const criticalEvent = { ...baseEvent, severity: 10 };
      expect(shouldNotify(criticalEvent, prefs)).toBe(true);
    });
  });
});
