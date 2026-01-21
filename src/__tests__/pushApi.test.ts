import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateRule,
  validateCondition,
  validatePreferences,
  RULE_LIMITS,
  NotificationRule,
  NotificationPreferences,
} from "@/types/notifications";

describe("Push API Validation", () => {
  describe("validateCondition", () => {
    it("should reject empty condition value", () => {
      const result = validateCondition({
        field: "severity",
        operator: ">=",
        value: "",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("required");
    });

    it("should reject 'in' operator with empty array", () => {
      const result = validateCondition({
        field: "category",
        operator: "in",
        value: [],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least one");
    });

    it("should accept 'in' operator with values", () => {
      const result = validateCondition({
        field: "category",
        operator: "in",
        value: ["MILITARY", "DIPLOMACY"],
      });
      expect(result.valid).toBe(true);
    });

    it("should reject non-numeric value for numeric field", () => {
      const result = validateCondition({
        field: "severity",
        operator: ">=",
        value: "abc",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("number");
    });

    it("should reject severity below minimum", () => {
      const result = validateCondition({
        field: "severity",
        operator: ">=",
        value: 0,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at least");
    });

    it("should reject severity above maximum", () => {
      const result = validateCondition({
        field: "severity",
        operator: ">=",
        value: 11,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("at most");
    });

    it("should accept valid severity", () => {
      const result = validateCondition({
        field: "severity",
        operator: ">=",
        value: 7,
      });
      expect(result.valid).toBe(true);
    });

    it("should accept string conditions", () => {
      const result = validateCondition({
        field: "title",
        operator: "contains",
        value: "Ukraine",
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("validateRule", () => {
    it("should reject rule with empty name", () => {
      const rule: NotificationRule = {
        id: "1",
        name: "",
        conditions: [{ field: "severity", operator: ">=", value: 7 }],
        enabled: true,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("name");
    });

    it("should reject rule with name too long", () => {
      const rule: NotificationRule = {
        id: "1",
        name: "a".repeat(RULE_LIMITS.MAX_RULE_NAME_LENGTH + 1),
        conditions: [{ field: "severity", operator: ">=", value: 7 }],
        enabled: true,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("characters");
    });

    it("should reject rule with no conditions", () => {
      const rule: NotificationRule = {
        id: "1",
        name: "Test Rule",
        conditions: [],
        enabled: true,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("condition");
    });

    it("should reject rule with too many conditions", () => {
      const conditions = Array.from({ length: RULE_LIMITS.MAX_CONDITIONS_PER_RULE + 1 }, () => ({
        field: "severity" as const,
        operator: ">=" as const,
        value: 5,
      }));
      const rule: NotificationRule = {
        id: "1",
        name: "Test Rule",
        conditions,
        enabled: true,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("conditions");
    });

    it("should reject rule with invalid condition", () => {
      const rule: NotificationRule = {
        id: "1",
        name: "Test Rule",
        conditions: [{ field: "severity", operator: ">=", value: "" }],
        enabled: true,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(false);
    });

    it("should accept valid rule", () => {
      const rule: NotificationRule = {
        id: "1",
        name: "High Severity Europe",
        conditions: [
          { field: "severity", operator: ">=", value: 7 },
          { field: "region", operator: "=", value: "EUROPE" },
        ],
        enabled: true,
      };
      const result = validateRule(rule);
      expect(result.valid).toBe(true);
    });
  });

  describe("validatePreferences", () => {
    it("should reject preferences with too many rules", () => {
      const rules = Array.from({ length: RULE_LIMITS.MAX_RULES + 1 }, (_, i) => ({
        id: String(i),
        name: `Rule ${i}`,
        conditions: [{ field: "severity" as const, operator: ">=" as const, value: 5 }],
        enabled: true,
      }));
      const prefs: NotificationPreferences = {
        enabled: true,
        rules,
        deliveryMode: "all",
      };
      const result = validatePreferences(prefs);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("rules");
    });

    it("should reject preferences with invalid rule", () => {
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [
          {
            id: "1",
            name: "",
            conditions: [{ field: "severity", operator: ">=", value: 7 }],
            enabled: true,
          },
        ],
        deliveryMode: "all",
      };
      const result = validatePreferences(prefs);
      expect(result.valid).toBe(false);
    });

    it("should accept valid preferences", () => {
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
      };
      const result = validatePreferences(prefs);
      expect(result.valid).toBe(true);
    });

    it("should accept empty rules array", () => {
      const prefs: NotificationPreferences = {
        enabled: true,
        rules: [],
        deliveryMode: "all",
      };
      const result = validatePreferences(prefs);
      expect(result.valid).toBe(true);
    });
  });

  describe("RULE_LIMITS constants", () => {
    it("should have reasonable limits", () => {
      expect(RULE_LIMITS.MAX_RULES).toBeGreaterThanOrEqual(5);
      expect(RULE_LIMITS.MAX_RULES).toBeLessThanOrEqual(20);
      expect(RULE_LIMITS.MAX_CONDITIONS_PER_RULE).toBeGreaterThanOrEqual(3);
      expect(RULE_LIMITS.MAX_CONDITIONS_PER_RULE).toBeLessThanOrEqual(10);
      expect(RULE_LIMITS.MAX_RULE_NAME_LENGTH).toBeGreaterThanOrEqual(30);
    });
  });
});
