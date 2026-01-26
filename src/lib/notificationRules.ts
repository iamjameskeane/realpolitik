/**
 * Notification Rule Matching Engine
 *
 * Evaluates events against user-defined notification rules.
 * Rules are OR-ed together (any match = notify).
 * Conditions within a rule are AND-ed together (all must match).
 */

import type {
  NotificationRule,
  NotificationPreferences,
  Condition,
  ConditionField,
  RegionName,
} from "@/types/notifications";
import { getRegionFromLocation, isInQuietHours } from "@/types/notifications";

// =============================================================================
// EVENT INTERFACE (subset needed for rule matching)
// =============================================================================

export interface EventForMatching {
  id: string;
  title: string;
  category: string;
  location_name: string;
  region?: string;
  severity: number;
  sources: { id: string }[];
}

// =============================================================================
// FIELD VALUE EXTRACTION
// =============================================================================

/**
 * Extract the value of a field from an event for condition evaluation
 */
function getEventFieldValue(event: EventForMatching, field: ConditionField): string | number {
  switch (field) {
    case "severity":
      return event.severity;

    case "category":
      return event.category;

    case "region":
      // Use event.region if available, otherwise extract from location
      return event.region || getRegionFromLocation(event.location_name);

    case "country":
      // Extract country from location_name
      // First try the last part after comma (e.g., "Kyiv, Ukraine" -> "Ukraine")
      const parts = event.location_name.split(",");
      const lastPart = parts.length > 1 ? parts[parts.length - 1].trim() : event.location_name;

      // Normalize common variations
      const normalized = lastPart
        .replace(/^Gaza Strip$/i, "Gaza")
        .replace(/^West Bank$/i, "Palestine")
        .replace(/^United States$/i, "USA")
        .replace(/^United Kingdom$/i, "UK");

      return normalized;

    case "sources":
      return event.sources?.length || 0;

    case "title":
      return event.title;

    case "location":
      return event.location_name;

    default:
      return "";
  }
}

// =============================================================================
// CONDITION EVALUATION
// =============================================================================

/**
 * Evaluate a single condition against an event
 */
export function evaluateCondition(event: EventForMatching, condition: Condition): boolean {
  const eventValue = getEventFieldValue(event, condition.field);
  const conditionValue = condition.value;

  switch (condition.operator) {
    case ">=":
      return Number(eventValue) >= Number(conditionValue);

    case "<=":
      return Number(eventValue) <= Number(conditionValue);

    case "=":
      if (typeof conditionValue === "number") {
        return Number(eventValue) === conditionValue;
      }
      return String(eventValue).toLowerCase() === String(conditionValue).toLowerCase();

    case "!=":
      if (typeof conditionValue === "number") {
        return Number(eventValue) !== conditionValue;
      }
      return String(eventValue).toLowerCase() !== String(conditionValue).toLowerCase();

    case "in":
      if (!Array.isArray(conditionValue)) {
        // Treat single value as array
        return String(eventValue).toLowerCase() === String(conditionValue).toLowerCase();
      }
      return conditionValue.some(
        (v) => String(eventValue).toLowerCase() === String(v).toLowerCase()
      );

    case "contains":
      return String(eventValue).toLowerCase().includes(String(conditionValue).toLowerCase());

    default:
      console.warn(`Unknown operator: ${condition.operator}`);
      return false;
  }
}

// =============================================================================
// RULE MATCHING
// =============================================================================

/**
 * Check if an event matches a single rule (all conditions must match)
 */
export function matchesRule(event: EventForMatching, rule: NotificationRule): boolean {
  // Disabled rules never match
  if (!rule.enabled) {
    return false;
  }

  // Empty conditions = no match (must have at least one condition)
  if (rule.conditions.length === 0) {
    return false;
  }

  // All conditions must match (AND)
  return rule.conditions.every((condition) => evaluateCondition(event, condition));
}

/**
 * Check if an event matches any of the user's rules (OR across rules)
 */
export function matchesRules(event: EventForMatching, rules: NotificationRule[]): boolean {
  // No rules = no notifications (must opt-in)
  if (!rules || rules.length === 0) {
    return false;
  }

  // Any enabled rule match triggers notification
  return rules.some((rule) => matchesRule(event, rule));
}

/**
 * Check if an event should trigger a notification based on user preferences
 */
export function shouldNotify(
  event: EventForMatching,
  preferences: NotificationPreferences
): boolean {
  // Notifications must be enabled
  if (!preferences.enabled) {
    return false;
  }

  // Check quiet hours (suppress notifications during quiet period)
  if (isInQuietHours(preferences.quietHours)) {
    return false;
  }

  // Check if event matches any rules
  return matchesRules(event, preferences.rules);
}

// =============================================================================
// RULE DEBUGGING
// =============================================================================

/**
 * Get detailed match results for debugging/preview
 */
export interface RuleMatchResult {
  rule: NotificationRule;
  matched: boolean;
  conditionResults: {
    condition: Condition;
    matched: boolean;
    eventValue: string | number;
  }[];
}

export function getDetailedMatchResults(
  event: EventForMatching,
  rules: NotificationRule[]
): RuleMatchResult[] {
  return rules.map((rule) => {
    const conditionResults = rule.conditions.map((condition) => {
      const eventValue = getEventFieldValue(event, condition.field);
      const matched = evaluateCondition(event, condition);
      return { condition, matched, eventValue };
    });

    const matched =
      rule.enabled && conditionResults.length > 0 && conditionResults.every((r) => r.matched);

    return { rule, matched, conditionResults };
  });
}

/**
 * Get which rules matched for an event (for logging/debugging)
 */
export function getMatchingRuleNames(event: EventForMatching, rules: NotificationRule[]): string[] {
  return rules.filter((rule) => matchesRule(event, rule)).map((rule) => rule.name);
}

// =============================================================================
// INBOX MATCHING (empty conditions = match all)
// =============================================================================

/**
 * Check if an event matches a single inbox rule
 * Unlike push rules, empty conditions = match all events
 */
export function matchesInboxRule(event: EventForMatching, rule: NotificationRule): boolean {
  // Disabled rules never match
  if (!rule.enabled) {
    return false;
  }

  // Empty conditions = match ALL events (inbox catch-all)
  if (rule.conditions.length === 0) {
    return true;
  }

  // All conditions must match (AND)
  return rule.conditions.every((condition) => evaluateCondition(event, condition));
}

/**
 * Check if an event matches any inbox rules
 */
export function matchesInboxRules(event: EventForMatching, rules: NotificationRule[]): boolean {
  // No rules = no match
  if (!rules || rules.length === 0) {
    return false;
  }

  return rules.some((rule) => matchesInboxRule(event, rule));
}

// =============================================================================
// BATCH MATCHING (for preview/testing)
// =============================================================================

/**
 * Find all events that would match the given rules
 */
export function filterMatchingEvents<T extends EventForMatching>(
  events: T[],
  rules: NotificationRule[]
): T[] {
  return events.filter((event) => matchesRules(event, rules));
}

/**
 * Count how many events would match the given rules
 */
export function countMatchingEvents(events: EventForMatching[], rules: NotificationRule[]): number {
  return events.filter((event) => matchesRules(event, rules)).length;
}
