/**
 * Tests for notification rule matching logic
 */

import { describe, it, expect } from "vitest";
import { matchesRules, evaluateCondition, shouldNotify } from "@/lib/notificationRules";
import { NotificationRule, NotificationPreferences, Condition } from "@/types/notifications";

// Sample event for testing
const sampleEvent = {
  id: "test-event-1",
  title: "Test Event: Diplomatic Summit in Europe",
  severity: 7,
  category: "DIPLOMACY",
  region: "EUROPE",
  location_name: "Geneva, Switzerland",
  sources_count: 3,
};

describe("evaluateCondition", () => {
  describe("severity conditions", () => {
    it("should match >= operator correctly", () => {
      const condition: Condition = {
        field: "severity",
        operator: ">=",
        value: 5,
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);

      const highCondition: Condition = {
        field: "severity",
        operator: ">=",
        value: 9,
      };
      expect(evaluateCondition(sampleEvent, highCondition)).toBe(false);
    });

    it("should match <= operator correctly", () => {
      const condition: Condition = {
        field: "severity",
        operator: "<=",
        value: 8,
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);
    });

    it("should match = operator correctly", () => {
      const condition: Condition = {
        field: "severity",
        operator: "=",
        value: 7,
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);

      const wrongCondition: Condition = {
        field: "severity",
        operator: "=",
        value: 5,
      };
      expect(evaluateCondition(sampleEvent, wrongCondition)).toBe(false);
    });
  });

  describe("category conditions", () => {
    it("should match exact category", () => {
      const condition: Condition = {
        field: "category",
        operator: "=",
        value: "DIPLOMACY",
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);
    });

    it("should match category in list", () => {
      const condition: Condition = {
        field: "category",
        operator: "in",
        value: ["DIPLOMACY", "MILITARY"],
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);
    });

    it("should not match category not in list", () => {
      const condition: Condition = {
        field: "category",
        operator: "in",
        value: ["MILITARY", "ECONOMY"],
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(false);
    });
  });

  describe("region conditions", () => {
    it("should match exact region", () => {
      const condition: Condition = {
        field: "region",
        operator: "=",
        value: "EUROPE",
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);
    });

    it("should match region in list", () => {
      const condition: Condition = {
        field: "region",
        operator: "in",
        value: ["EUROPE", "AMERICAS"],
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);
    });

    it("should not match excluded region", () => {
      const condition: Condition = {
        field: "region",
        operator: "!=",
        value: "EUROPE",
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(false);
    });
  });

  describe("title/location contains", () => {
    it("should match title containing text", () => {
      const condition: Condition = {
        field: "title",
        operator: "contains",
        value: "Diplomatic",
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);
    });

    it("should be case-insensitive", () => {
      const condition: Condition = {
        field: "title",
        operator: "contains",
        value: "DIPLOMATIC",
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);
    });

    it("should match location containing text", () => {
      const condition: Condition = {
        field: "location",
        operator: "contains",
        value: "Switzerland",
      };
      expect(evaluateCondition(sampleEvent, condition)).toBe(true);
    });
  });
});

describe("matchesRules", () => {
  it("should return true when at least one rule matches (OR logic)", () => {
    const rules: NotificationRule[] = [
      {
        id: "rule-1",
        name: "High Severity",
        enabled: true,
        conditions: [{ field: "severity", operator: ">=", value: 9 }],
      },
      {
        id: "rule-2",
        name: "Europe Events",
        enabled: true,
        conditions: [{ field: "region", operator: "=", value: "EUROPE" }],
      },
    ];

    // First rule fails (severity 7 < 9), second rule passes (region = EUROPE)
    expect(matchesRules(sampleEvent, rules)).toBe(true);
  });

  it("should return false when no rules match", () => {
    const rules: NotificationRule[] = [
      {
        id: "rule-1",
        name: "High Severity",
        enabled: true,
        conditions: [{ field: "severity", operator: ">=", value: 9 }],
      },
      {
        id: "rule-2",
        name: "Asia Events",
        enabled: true,
        conditions: [{ field: "region", operator: "=", value: "ASIA_PACIFIC" }],
      },
    ];

    expect(matchesRules(sampleEvent, rules)).toBe(false);
  });

  it("should require ALL conditions in a rule to match (AND logic)", () => {
    const rules: NotificationRule[] = [
      {
        id: "rule-1",
        name: "High Severity Europe",
        enabled: true,
        conditions: [
          { field: "severity", operator: ">=", value: 9 },
          { field: "region", operator: "=", value: "EUROPE" },
        ],
      },
    ];

    // Region matches but severity doesn't - should fail
    expect(matchesRules(sampleEvent, rules)).toBe(false);
  });

  it("should skip disabled rules", () => {
    const rules: NotificationRule[] = [
      {
        id: "rule-1",
        name: "Disabled Rule",
        enabled: false,
        conditions: [{ field: "region", operator: "=", value: "EUROPE" }],
      },
    ];

    expect(matchesRules(sampleEvent, rules)).toBe(false);
  });

  it("should return false for empty rules array", () => {
    expect(matchesRules(sampleEvent, [])).toBe(false);
  });
});

describe("shouldNotify", () => {
  it("should return false when notifications disabled", () => {
    const preferences: NotificationPreferences = {
      enabled: false,
      rules: [
        {
          id: "rule-1",
          name: "All Events",
          enabled: true,
          conditions: [{ field: "severity", operator: ">=", value: 1 }],
        },
      ],
    };

    expect(shouldNotify(sampleEvent, preferences)).toBe(false);
  });

  it("should return false during quiet hours", () => {
    const now = new Date();
    const currentHour = now.getHours();

    const preferences: NotificationPreferences = {
      enabled: true,
      rules: [
        {
          id: "rule-1",
          name: "All Events",
          enabled: true,
          conditions: [{ field: "severity", operator: ">=", value: 1 }],
        },
      ],
      quietHours: {
        enabled: true,
        start: `${String(currentHour).padStart(2, "0")}:00`,
        end: `${String((currentHour + 2) % 24).padStart(2, "0")}:00`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    expect(shouldNotify(sampleEvent, preferences)).toBe(false);
  });

  it("should return true when rules match and notifications enabled", () => {
    const preferences: NotificationPreferences = {
      enabled: true,
      rules: [
        {
          id: "rule-1",
          name: "Europe Events",
          enabled: true,
          conditions: [{ field: "region", operator: "=", value: "EUROPE" }],
        },
      ],
    };

    expect(shouldNotify(sampleEvent, preferences)).toBe(true);
  });
});
