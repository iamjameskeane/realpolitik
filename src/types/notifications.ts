/**
 * Notification Rule Types
 *
 * Defines the rule-based notification system that allows users to create
 * sophisticated filtering rules for their alerts.
 *
 * Rules are OR-ed together (any match = notify)
 * Conditions within a rule are AND-ed together (all must match)
 */

// =============================================================================
// REGION DEFINITIONS
// =============================================================================

export const REGIONS = {
  MIDDLE_EAST: [
    "Israel",
    "Palestine",
    "Gaza",
    "Lebanon",
    "Syria",
    "Iran",
    "Iraq",
    "Yemen",
    "Saudi Arabia",
    "UAE",
    "Qatar",
    "Jordan",
    "Kuwait",
    "Bahrain",
    "Oman",
  ],
  EAST_ASIA: ["China", "Taiwan", "Japan", "South Korea", "North Korea", "Hong Kong", "Mongolia"],
  SOUTHEAST_ASIA: [
    "Vietnam",
    "Philippines",
    "Indonesia",
    "Malaysia",
    "Thailand",
    "Myanmar",
    "Singapore",
    "Cambodia",
    "Laos",
    "Brunei",
    "Timor-Leste",
  ],
  SOUTH_ASIA: [
    "India",
    "Pakistan",
    "Bangladesh",
    "Sri Lanka",
    "Nepal",
    "Afghanistan",
    "Bhutan",
    "Maldives",
  ],
  EUROPE: [
    "Ukraine",
    "Russia",
    "Poland",
    "Germany",
    "France",
    "UK",
    "United Kingdom",
    "Belarus",
    "Moldova",
    "Romania",
    "Hungary",
    "Serbia",
    "Kosovo",
    "Bosnia",
    "Croatia",
    "Slovenia",
    "Montenegro",
    "Albania",
    "North Macedonia",
    "Greece",
    "Bulgaria",
    "Italy",
    "Spain",
    "Portugal",
    "Netherlands",
    "Belgium",
    "Austria",
    "Switzerland",
    "Czech Republic",
    "Slovakia",
    "Denmark",
    "Norway",
    "Sweden",
    "Finland",
    "Estonia",
    "Latvia",
    "Lithuania",
    "Ireland",
    "Iceland",
  ],
  AFRICA: [
    "Sudan",
    "South Sudan",
    "Ethiopia",
    "Libya",
    "Egypt",
    "Nigeria",
    "South Africa",
    "DRC",
    "Democratic Republic of Congo",
    "Somalia",
    "Mali",
    "Niger",
    "Burkina Faso",
    "Chad",
    "Central African Republic",
    "Cameroon",
    "Kenya",
    "Uganda",
    "Rwanda",
    "Tanzania",
    "Mozambique",
    "Zimbabwe",
    "Algeria",
    "Morocco",
    "Tunisia",
  ],
  AMERICAS: [
    "USA",
    "United States",
    "Mexico",
    "Venezuela",
    "Brazil",
    "Argentina",
    "Colombia",
    "Cuba",
    "Canada",
    "Peru",
    "Chile",
    "Ecuador",
    "Bolivia",
    "Paraguay",
    "Uruguay",
    "Haiti",
    "Dominican Republic",
    "Guatemala",
    "Honduras",
    "El Salvador",
    "Nicaragua",
    "Panama",
  ],
  CENTRAL_ASIA: [
    "Kazakhstan",
    "Uzbekistan",
    "Turkmenistan",
    "Tajikistan",
    "Kyrgyzstan",
    "Azerbaijan",
    "Armenia",
    "Georgia",
  ],
  OCEANIA: ["Australia", "New Zealand", "Papua New Guinea", "Fiji", "Solomon Islands"],
} as const;

export type RegionName = keyof typeof REGIONS;

export const REGION_LABELS: Record<RegionName, string> = {
  MIDDLE_EAST: "Middle East",
  EAST_ASIA: "East Asia",
  SOUTHEAST_ASIA: "Southeast Asia",
  SOUTH_ASIA: "South Asia",
  EUROPE: "Europe",
  AFRICA: "Africa",
  AMERICAS: "Americas",
  CENTRAL_ASIA: "Central Asia",
  OCEANIA: "Oceania",
};

// =============================================================================
// CONDITION TYPES
// =============================================================================

export type ConditionField =
  | "severity" // 1-10
  | "category" // MILITARY, DIPLOMACY, ECONOMY, UNREST
  | "region" // EUROPE, MIDDLE_EAST, EAST_ASIA, etc.
  | "country" // Extracted from location_name
  | "sources" // Number of sources (1-10+)
  | "title" // Event title text
  | "location"; // Location name text

export type NumericOperator = ">=" | "<=" | "=" | "!=";
export type TextOperator = "contains";
export type ListOperator = "in" | "=";
export type Operator = NumericOperator | TextOperator | ListOperator;

export type ConditionValue = number | string | string[];

export interface Condition {
  field: ConditionField;
  operator: Operator;
  value: ConditionValue;
}

// Field metadata for UI rendering
export interface FieldConfig {
  field: ConditionField;
  label: string;
  type: "numeric" | "select" | "multiselect" | "text";
  operators: Operator[];
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export const FIELD_CONFIGS: FieldConfig[] = [
  {
    field: "severity",
    label: "Severity",
    type: "numeric",
    operators: [">=", "<=", "=", "!="],
    min: 1,
    max: 10,
  },
  {
    field: "category",
    label: "Category",
    type: "select",
    operators: ["=", "!=", "in"],
    options: [
      { value: "MILITARY", label: "Military" },
      { value: "DIPLOMACY", label: "Diplomacy" },
      { value: "ECONOMY", label: "Economy" },
      { value: "UNREST", label: "Unrest" },
    ],
  },
  {
    field: "region",
    label: "Region",
    type: "select",
    operators: ["=", "!=", "in"],
    options: Object.entries(REGION_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  },
  {
    field: "country",
    label: "Country",
    type: "select",
    operators: ["=", "!=", "in"],
    options: [
      // Middle East
      { value: "Israel", label: "Israel" },
      { value: "Palestine", label: "Palestine" },
      { value: "Gaza", label: "Gaza" },
      { value: "Lebanon", label: "Lebanon" },
      { value: "Syria", label: "Syria" },
      { value: "Iran", label: "Iran" },
      { value: "Iraq", label: "Iraq" },
      { value: "Yemen", label: "Yemen" },
      { value: "Saudi Arabia", label: "Saudi Arabia" },
      { value: "UAE", label: "UAE" },
      { value: "Qatar", label: "Qatar" },
      { value: "Jordan", label: "Jordan" },
      // East Asia
      { value: "China", label: "China" },
      { value: "Taiwan", label: "Taiwan" },
      { value: "Japan", label: "Japan" },
      { value: "South Korea", label: "South Korea" },
      { value: "North Korea", label: "North Korea" },
      // Southeast Asia
      { value: "Vietnam", label: "Vietnam" },
      { value: "Philippines", label: "Philippines" },
      { value: "Indonesia", label: "Indonesia" },
      { value: "Malaysia", label: "Malaysia" },
      { value: "Thailand", label: "Thailand" },
      { value: "Myanmar", label: "Myanmar" },
      { value: "Singapore", label: "Singapore" },
      // South Asia
      { value: "India", label: "India" },
      { value: "Pakistan", label: "Pakistan" },
      { value: "Bangladesh", label: "Bangladesh" },
      { value: "Afghanistan", label: "Afghanistan" },
      { value: "Sri Lanka", label: "Sri Lanka" },
      // Europe
      { value: "Ukraine", label: "Ukraine" },
      { value: "Russia", label: "Russia" },
      { value: "Poland", label: "Poland" },
      { value: "Germany", label: "Germany" },
      { value: "France", label: "France" },
      { value: "UK", label: "United Kingdom" },
      { value: "Belarus", label: "Belarus" },
      { value: "Moldova", label: "Moldova" },
      { value: "Romania", label: "Romania" },
      { value: "Serbia", label: "Serbia" },
      { value: "Kosovo", label: "Kosovo" },
      // Africa
      { value: "Sudan", label: "Sudan" },
      { value: "South Sudan", label: "South Sudan" },
      { value: "Ethiopia", label: "Ethiopia" },
      { value: "Libya", label: "Libya" },
      { value: "Egypt", label: "Egypt" },
      { value: "Nigeria", label: "Nigeria" },
      { value: "South Africa", label: "South Africa" },
      { value: "DRC", label: "DR Congo" },
      { value: "Somalia", label: "Somalia" },
      { value: "Mali", label: "Mali" },
      // Americas
      { value: "USA", label: "United States" },
      { value: "Mexico", label: "Mexico" },
      { value: "Venezuela", label: "Venezuela" },
      { value: "Brazil", label: "Brazil" },
      { value: "Argentina", label: "Argentina" },
      { value: "Colombia", label: "Colombia" },
      { value: "Cuba", label: "Cuba" },
      { value: "Canada", label: "Canada" },
      // Central Asia
      { value: "Kazakhstan", label: "Kazakhstan" },
      { value: "Azerbaijan", label: "Azerbaijan" },
      { value: "Armenia", label: "Armenia" },
      { value: "Georgia", label: "Georgia" },
      // Oceania
      { value: "Australia", label: "Australia" },
      { value: "New Zealand", label: "New Zealand" },
    ],
  },
  {
    field: "sources",
    label: "Sources",
    type: "numeric",
    operators: [">=", "<=", "="],
    min: 1,
    max: 20,
  },
  {
    field: "title",
    label: "Title",
    type: "text",
    operators: ["contains"],
  },
  {
    field: "location",
    label: "Location",
    type: "text",
    operators: ["contains"],
  },
];

// =============================================================================
// RULE TYPES
// =============================================================================

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: Condition[];
  sendPush?: boolean; // If true, sends push notifications (default: false, inbox only)
}

// =============================================================================
// PREFERENCES TYPES
// =============================================================================

export type DeliveryMode = "realtime" | "digest";

export interface QuietHours {
  enabled: boolean;
  start: string; // "22:00" (24-hour format)
  end: string; // "07:00" (24-hour format)
  timezone: string; // IANA timezone e.g. "America/New_York"
}

/**
 * Common timezones for the UI dropdown
 */
export const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (US)" },
  { value: "America/Chicago", label: "Central Time (US)" },
  { value: "America/Denver", label: "Mountain Time (US)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US)" },
  { value: "America/Toronto", label: "Eastern Time (Canada)" },
  { value: "America/Vancouver", label: "Pacific Time (Canada)" },
  { value: "Europe/London", label: "London (UK)" },
  { value: "Europe/Paris", label: "Central European Time" },
  { value: "Europe/Berlin", label: "Berlin (Germany)" },
  { value: "Europe/Moscow", label: "Moscow (Russia)" },
  { value: "Europe/Istanbul", label: "Istanbul (Turkey)" },
  { value: "Asia/Dubai", label: "Dubai (UAE)" },
  { value: "Asia/Kolkata", label: "India Standard Time" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Shanghai", label: "China Standard Time" },
  { value: "Asia/Tokyo", label: "Tokyo (Japan)" },
  { value: "Asia/Seoul", label: "Seoul (Korea)" },
  { value: "Australia/Sydney", label: "Sydney (Australia)" },
  { value: "Australia/Melbourne", label: "Melbourne (Australia)" },
  { value: "Pacific/Auckland", label: "Auckland (New Zealand)" },
] as const;

/**
 * Default quiet hours configuration
 */
export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  start: "22:00",
  end: "07:00",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
};

/**
 * Check if current time is within quiet hours.
 * Returns true if notifications should be suppressed.
 */
export function isInQuietHours(quietHours: QuietHours | undefined): boolean {
  if (!quietHours?.enabled) return false;

  try {
    // Get current time in the user's timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: quietHours.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const currentTime = formatter.format(now); // "22:30" format

    const [currentHour, currentMin] = currentTime.split(":").map(Number);
    const [startHour, startMin] = quietHours.start.split(":").map(Number);
    const [endHour, endMin] = quietHours.end.split(":").map(Number);

    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startMinutes > endMinutes) {
      // Quiet hours span midnight
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // Same-day quiet hours (e.g., 14:00 to 16:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch {
    // If timezone parsing fails, don't suppress notifications
    return false;
  }
}

export interface NotificationPreferences {
  enabled: boolean;
  rules: NotificationRule[];
  mode: DeliveryMode;
  digestTime?: string; // "08:00" UTC
  quietHours?: QuietHours;
}

// Legacy preferences for migration
export interface LegacyPreferences {
  enabled: boolean;
  minSeverity: number;
  categories: ("MILITARY" | "DIPLOMACY" | "ECONOMY" | "UNREST")[];
}

// =============================================================================
// LIMITS
// =============================================================================

export const RULE_LIMITS = {
  MAX_RULES: 10,
  MAX_CONDITIONS_PER_RULE: 5,
  MAX_RULE_NAME_LENGTH: 50,
} as const;

// Tier-based limits
export type UserTier = "free" | "pro" | "enterprise";

export interface TierLimits {
  maxRules: number;
  minSeverity: number; // Minimum allowed severity (free can only do 9-10)
  canCustomize: boolean; // Can customize beyond presets
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free: {
    maxRules: 1,
    minSeverity: 9, // Only sev 9-10
    canCustomize: false,
  },
  pro: {
    maxRules: 10,
    minSeverity: 1, // Any severity
    canCustomize: true,
  },
  enterprise: {
    maxRules: 50,
    minSeverity: 1,
    canCustomize: true,
  },
};

/**
 * Get tier limits for a given tier
 */
export function getTierLimits(tier: UserTier | undefined): TierLimits {
  return TIER_LIMITS[tier || "free"];
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_RULE: NotificationRule = {
  id: "default-critical",
  name: "Critical Events",
  enabled: true,
  sendPush: true,
  conditions: [{ field: "severity", operator: ">=", value: 9 }],
};

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: false,
  rules: [], // Empty by default - users must opt-in to avoid spam
  mode: "realtime",
};

// =============================================================================
// PRESETS
// =============================================================================

export interface RulePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  estimatedDaily: string;
  rules: NotificationRule[];
  recommended?: boolean;
}

export const RULE_PRESETS: RulePreset[] = [
  {
    id: "critical-only",
    name: "Critical Only",
    icon: "🚨",
    description: "Only the most critical events (severity 9-10)",
    estimatedDaily: "~1-3 per day",
    recommended: true,
    rules: [
      {
        id: "critical",
        name: "Critical Events",
        enabled: true,
        sendPush: true,
        conditions: [{ field: "severity", operator: ">=", value: 9 }],
      },
    ],
  },
  {
    id: "breaking-only",
    name: "Breaking News",
    icon: "📰",
    description: "Major events confirmed by 2+ sources (Pro)",
    estimatedDaily: "~2-5 per day",
    rules: [
      {
        id: "breaking",
        name: "Breaking Only",
        enabled: true,
        sendPush: true,
        conditions: [
          { field: "severity", operator: ">=", value: 8 },
          { field: "sources", operator: ">=", value: 2 },
        ],
      },
    ],
  },
  {
    id: "global-analyst",
    name: "Global Analyst",
    icon: "🌍",
    description: "All significant events worldwide",
    estimatedDaily: "~10-20 per day",
    rules: [
      {
        id: "significant",
        name: "Significant Events",
        enabled: true,
        sendPush: false, // Inbox only - too many for push
        conditions: [{ field: "severity", operator: ">=", value: 6 }],
      },
    ],
  },
  {
    id: "military-focus",
    name: "Military Only",
    icon: "⚔️",
    description: "Armed conflict events, confirmed",
    estimatedDaily: "~3-8 per day",
    rules: [
      {
        id: "military",
        name: "Military Events",
        enabled: true,
        sendPush: true, // Push for military events
        conditions: [
          { field: "category", operator: "=", value: "MILITARY" },
          { field: "sources", operator: ">=", value: 2 },
        ],
      },
    ],
  },
  {
    id: "europe-mena",
    name: "Europe & Middle East",
    icon: "🗺️",
    description: "Focus on European and Middle Eastern events",
    estimatedDaily: "~5-15 per day",
    rules: [
      {
        id: "europe",
        name: "Europe 7+",
        enabled: true,
        sendPush: true, // Push for high severity Europe
        conditions: [
          { field: "region", operator: "=", value: "EUROPE" },
          { field: "severity", operator: ">=", value: 7 },
        ],
      },
      {
        id: "mena",
        name: "Middle East 5+",
        enabled: true,
        sendPush: false, // Inbox only - high volume region
        conditions: [
          { field: "region", operator: "=", value: "MIDDLE_EAST" },
          { field: "severity", operator: ">=", value: 5 },
        ],
      },
    ],
  },
  {
    id: "asia-pacific",
    name: "Asia-Pacific Watch",
    icon: "🌏",
    description: "East Asia, Southeast Asia, and South Asia focus",
    estimatedDaily: "~5-12 per day",
    rules: [
      {
        id: "asia-military",
        name: "Asia Military",
        enabled: true,
        sendPush: false, // Inbox only
        conditions: [
          { field: "region", operator: "in", value: ["EAST_ASIA", "SOUTH_ASIA", "SOUTHEAST_ASIA"] },
          { field: "category", operator: "=", value: "MILITARY" },
          { field: "severity", operator: ">=", value: 5 },
        ],
      },
      {
        id: "asia-critical",
        name: "Asia Critical",
        enabled: true,
        sendPush: true, // Push for critical Asia events
        conditions: [
          { field: "region", operator: "in", value: ["EAST_ASIA", "SOUTH_ASIA", "SOUTHEAST_ASIA"] },
          { field: "severity", operator: ">=", value: 8 },
        ],
      },
    ],
  },
];

// =============================================================================
// MIGRATION HELPER
// =============================================================================

/**
 * Convert legacy preferences (minSeverity + categories) to new rule-based format
 */
export function migrateLegacyPreferences(legacy: LegacyPreferences): NotificationPreferences {
  const conditions: Condition[] = [];

  if (legacy.minSeverity) {
    conditions.push({
      field: "severity",
      operator: ">=",
      value: legacy.minSeverity,
    });
  }

  if (legacy.categories && legacy.categories.length > 0 && legacy.categories.length < 4) {
    // Only add category filter if not all categories are selected
    conditions.push({
      field: "category",
      operator: "in",
      value: legacy.categories,
    });
  }

  // If no conditions from legacy, don't create any rules - user must opt-in
  const rules: NotificationRule[] =
    conditions.length > 0
      ? [
          {
            id: "migrated",
            name: "My Alerts",
            enabled: true,
            conditions,
          },
        ]
      : [];

  return {
    enabled: legacy.enabled,
    rules,
    mode: "realtime",
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get region from a location name by checking country keywords
 */
export function getRegionFromLocation(locationName: string): RegionName | "OTHER" {
  const location = locationName.toLowerCase();

  for (const [region, countries] of Object.entries(REGIONS)) {
    for (const country of countries) {
      if (location.includes(country.toLowerCase())) {
        return region as RegionName;
      }
    }
  }

  return "OTHER";
}

/**
 * Generate a unique ID for a new rule
 */
export function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create a new empty rule
 */
export function createEmptyRule(): NotificationRule {
  return {
    id: generateRuleId(),
    name: "New Rule",
    enabled: true,
    sendPush: false, // Default to inbox only (safer)
    conditions: [{ field: "severity", operator: ">=", value: 7 }],
  };
}

/**
 * Validation result with optional error message
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a rule is valid and within limits
 */
export function isValidRule(rule: NotificationRule): boolean {
  return validateRule(rule).valid;
}

/**
 * Validate a rule with detailed error message
 */
export function validateRule(rule: NotificationRule): ValidationResult {
  if (!rule.name.trim()) {
    return { valid: false, error: "Rule name is required" };
  }

  if (rule.name.length > RULE_LIMITS.MAX_RULE_NAME_LENGTH) {
    return {
      valid: false,
      error: `Rule name must be ${RULE_LIMITS.MAX_RULE_NAME_LENGTH} characters or less`,
    };
  }

  if (rule.conditions.length === 0) {
    return { valid: false, error: "At least one condition is required" };
  }

  if (rule.conditions.length > RULE_LIMITS.MAX_CONDITIONS_PER_RULE) {
    return {
      valid: false,
      error: `Maximum ${RULE_LIMITS.MAX_CONDITIONS_PER_RULE} conditions per rule`,
    };
  }

  // Validate each condition
  for (const condition of rule.conditions) {
    const result = validateCondition(condition);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Validate a single condition
 */
export function validateCondition(condition: Condition): ValidationResult {
  if (condition.value === undefined || condition.value === "") {
    return { valid: false, error: "Condition value is required" };
  }

  // Validate "in" operator has non-empty array
  if (condition.operator === "in") {
    if (!Array.isArray(condition.value) || condition.value.length === 0) {
      return { valid: false, error: "Select at least one value" };
    }
  }

  // Validate numeric fields
  const fieldConfig = FIELD_CONFIGS.find((f) => f.field === condition.field);
  if (fieldConfig?.type === "numeric") {
    const numValue = Number(condition.value);
    if (isNaN(numValue)) {
      return { valid: false, error: `${fieldConfig.label} must be a number` };
    }
    if (fieldConfig.min !== undefined && numValue < fieldConfig.min) {
      return { valid: false, error: `${fieldConfig.label} must be at least ${fieldConfig.min}` };
    }
    if (fieldConfig.max !== undefined && numValue > fieldConfig.max) {
      return { valid: false, error: `${fieldConfig.label} must be at most ${fieldConfig.max}` };
    }
  }

  return { valid: true };
}

/**
 * Validate entire notification preferences
 */
export function validatePreferences(prefs: NotificationPreferences): ValidationResult {
  if (prefs.rules.length > RULE_LIMITS.MAX_RULES) {
    return { valid: false, error: `Maximum ${RULE_LIMITS.MAX_RULES} rules allowed` };
  }

  for (const rule of prefs.rules) {
    const result = validateRule(rule);
    if (!result.valid) {
      return { valid: false, error: `Rule "${rule.name}": ${result.error}` };
    }
  }

  return { valid: true };
}

/**
 * Get a human-readable summary of a rule's conditions
 */
export function getRuleSummary(rule: NotificationRule): string {
  if (rule.conditions.length === 0) return "No conditions";

  return rule.conditions
    .map((c) => {
      const field = FIELD_CONFIGS.find((f) => f.field === c.field);
      const fieldLabel = field?.label || c.field;

      let valueLabel: string;
      if (Array.isArray(c.value)) {
        if (c.field === "region") {
          valueLabel = c.value.map((v) => REGION_LABELS[v as RegionName] || v).join(", ");
        } else {
          valueLabel = c.value.join(", ");
        }
      } else if (c.field === "region" && typeof c.value === "string") {
        valueLabel = REGION_LABELS[c.value as RegionName] || c.value;
      } else {
        valueLabel = String(c.value);
      }

      const operatorLabel =
        c.operator === ">="
          ? "≥"
          : c.operator === "<="
            ? "≤"
            : c.operator === "!="
              ? "≠"
              : c.operator;

      return `${fieldLabel} ${operatorLabel} ${valueLabel}`;
    })
    .join(" AND ");
}
