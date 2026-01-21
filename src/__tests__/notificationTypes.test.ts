/**
 * Tests for notification types and validation
 */

import { describe, it, expect } from "vitest";
import {
  validateCondition,
  validateRule,
  validatePreferences,
  migrateLegacyPreferences,
  getRuleSummary,
  RULE_LIMITS,
  FIELD_CONFIGS,
  DEFAULT_PREFERENCES,
} from "@/types/notifications";
import type { NotificationRule, NotificationPreferences, Condition } from "@/types/notifications";

describe("validateCondition", () => {
  it("should reject empty value", () => {
    const condition: Condition = {
      field: "severity",
      operator: ">=",
      value: "",
    };
    const result = validateCondition(condition);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("required");
  });

  it("should reject empty array for 'in' operator", () => {
    const condition: Condition = {
      field: "category",
      operator: "in",
      value: [],
    };
    const result = validateCondition(condition);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("at least one");
  });

  it("should reject non-numeric value for numeric fields", () => {
    const condition: Condition = {
      field: "severity",
      operator: ">=",
      value: "not-a-number",
    };
    const result = validateCondition(condition);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("number");
  });

  it("should reject severity below minimum", () => {
    const condition: Condition = {
      field: "severity",
      operator: ">=",
      value: -1,
    };
    const result = validateCondition(condition);
    expect(result.valid).toBe(false);
  });

  it("should reject severity above maximum", () => {
    const condition: Condition = {
      field: "severity",
      operator: ">=",
      value: 15,
    };
    const result = validateCondition(condition);
    expect(result.valid).toBe(false);
  });

  it("should accept valid conditions", () => {
    const condition: Condition = {
      field: "severity",
      operator: ">=",
      value: 5,
    };
    const result = validateCondition(condition);
    expect(result.valid).toBe(true);
  });
});

describe("validateRule", () => {
  it("should reject empty rule name", () => {
    const rule: NotificationRule = {
      id: "rule-1",
      name: "",
      enabled: true,
      conditions: [{ field: "severity", operator: ">=", value: 5 }],
    };
    const result = validateRule(rule);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("name");
  });

  it("should reject rule name exceeding max length", () => {
    const rule: NotificationRule = {
      id: "rule-1",
      name: "A".repeat(RULE_LIMITS.MAX_RULE_NAME_LENGTH + 1),
      enabled: true,
      conditions: [{ field: "severity", operator: ">=", value: 5 }],
    };
    const result = validateRule(rule);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("characters");
  });

  it("should reject rule with no conditions", () => {
    const rule: NotificationRule = {
      id: "rule-1",
      name: "Test Rule",
      enabled: true,
      conditions: [],
    };
    const result = validateRule(rule);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("condition");
  });

  it("should reject rule exceeding max conditions", () => {
    const conditions: Condition[] = Array(RULE_LIMITS.MAX_CONDITIONS_PER_RULE + 1)
      .fill(null)
      .map(() => ({ field: "severity", operator: ">=", value: 5 }));

    const rule: NotificationRule = {
      id: "rule-1",
      name: "Test Rule",
      enabled: true,
      conditions,
    };
    const result = validateRule(rule);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Maximum");
  });

  it("should accept valid rule", () => {
    const rule: NotificationRule = {
      id: "rule-1",
      name: "Test Rule",
      enabled: true,
      conditions: [{ field: "severity", operator: ">=", value: 5 }],
    };
    const result = validateRule(rule);
    expect(result.valid).toBe(true);
  });
});

describe("validatePreferences", () => {
  it("should reject too many rules", () => {
    const rules: NotificationRule[] = Array(RULE_LIMITS.MAX_RULES + 1)
      .fill(null)
      .map((_, i) => ({
        id: `rule-${i}`,
        name: `Rule ${i}`,
        enabled: true,
        conditions: [{ field: "severity", operator: ">=", value: 5 }],
      }));

    const prefs: NotificationPreferences = {
      enabled: true,
      rules,
    };
    const result = validatePreferences(prefs);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Maximum");
  });

  it("should accept valid preferences", () => {
    const prefs: NotificationPreferences = {
      enabled: true,
      rules: [
        {
          id: "rule-1",
          name: "Test Rule",
          enabled: true,
          conditions: [{ field: "severity", operator: ">=", value: 5 }],
        },
      ],
    };
    const result = validatePreferences(prefs);
    expect(result.valid).toBe(true);
  });
});

describe("migrateLegacyPreferences", () => {
  it("should migrate minSeverity to rule", () => {
    const legacy = {
      enabled: true,
      minSeverity: 7,
    };

    const migrated = migrateLegacyPreferences(legacy);

    expect(migrated.rules).toBeDefined();
    expect(migrated.rules.length).toBeGreaterThan(0);
    // Should have a rule with severity >= 7
    const severityCondition = migrated.rules[0]?.conditions.find(
      (c) => c.field === "severity" && c.operator === ">=" && c.value === 7
    );
    expect(severityCondition).toBeDefined();
  });

  it("should migrate categories to rule", () => {
    const legacy = {
      enabled: true,
      categories: ["DIPLOMACY", "MILITARY"],
    };

    const migrated = migrateLegacyPreferences(legacy);

    expect(migrated.rules).toBeDefined();
    // Should have a category condition
    const hasCategories = migrated.rules.some((r) =>
      r.conditions.some((c) => c.field === "category")
    );
    expect(hasCategories).toBe(true);
  });

  it("should return default rule when no legacy fields present", () => {
    // When passed data without legacy minSeverity/categories,
    // the function returns default rules (not the input rules)
    const emptyLegacy = {
      enabled: true,
      minSeverity: 0, // falsy
      categories: [],
    };

    const migrated = migrateLegacyPreferences(emptyLegacy);

    // Should have at least one rule (the default)
    expect(migrated.rules.length).toBeGreaterThanOrEqual(1);
    expect(migrated.enabled).toBe(true);
  });
});

describe("getRuleSummary", () => {
  it("should generate readable summary", () => {
    const rule: NotificationRule = {
      id: "rule-1",
      name: "High Priority",
      enabled: true,
      conditions: [
        { field: "severity", operator: ">=", value: 8 },
        { field: "region", operator: "=", value: "EUROPE" },
      ],
    };

    const summary = getRuleSummary(rule);

    // Summary contains field info (case may vary)
    expect(summary.toLowerCase()).toContain("severity");
    expect(summary).toContain("8");
    // Region value might be formatted (e.g., "Europe" instead of "EUROPE")
    expect(summary.toLowerCase()).toContain("europe");
  });
});

describe("FIELD_CONFIGS", () => {
  it("should have all required fields configured", () => {
    const requiredFields = ["severity", "category", "region", "sources", "title", "location"];

    for (const field of requiredFields) {
      const config = FIELD_CONFIGS.find((c) => c.field === field);
      expect(config).toBeDefined();
      expect(config?.label).toBeDefined();
      expect(config?.operators).toBeDefined();
    }
  });
});

describe("RULE_LIMITS", () => {
  it("should have reasonable limits", () => {
    expect(RULE_LIMITS.MAX_RULES).toBeGreaterThan(0);
    expect(RULE_LIMITS.MAX_RULES).toBeLessThanOrEqual(20);
    expect(RULE_LIMITS.MAX_CONDITIONS_PER_RULE).toBeGreaterThan(0);
    expect(RULE_LIMITS.MAX_CONDITIONS_PER_RULE).toBeLessThanOrEqual(10);
    expect(RULE_LIMITS.MAX_RULE_NAME_LENGTH).toBeGreaterThan(0);
  });
});
