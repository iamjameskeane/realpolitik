/**
 * Centralized constants for Realpolitik
 *
 * This file contains all magic numbers and configuration values
 * that are used across multiple files. Keep thresholds and timing
 * values here for easy adjustment.
 */

// =============================================================================
// MAP SETTINGS
// =============================================================================

/**
 * MAP_PADDING - Critical for globe centering
 *
 * Problem: The Mapbox globe projection doesn't respect setPadding() properly.
 * When you call setPadding() once, it works initially, but any subsequent camera
 * animation (flyTo, easeTo) resets the padding, causing the globe to drift down.
 *
 * Solution: We must pass `padding: MAP_PADDING` to EVERY camera animation call
 * (flyTo, easeTo, jumpTo) throughout the codebase. This includes:
 * - WorldMap.tsx: event clicks, 2D/3D toggle
 * - useEventLayers.ts: cluster clicks, double-clicks
 * - useAutoRotate.ts: zoom out animation
 *
 * The bottom padding (280px) accounts for the bottom UI elements (time slider,
 * category legend) so the globe appears visually centered in the available space.
 *
 * WARNING: Do NOT add a moveend listener to reapply padding - this causes the
 * zoom/pan pivot point to shift when the sidebar is open.
 */
export const MAP_PADDING = { top: 0, bottom: 280, left: 0, right: 0 };

/** Time before auto-rotate kicks in after user interaction (ms) */
export const AUTO_ROTATE_DELAY_MS = 15000;

/** Duration of zoom-out animation when auto-rotate starts (ms) */
export const ZOOM_OUT_DURATION_MS = 2000;

/** Default zoom level for globe view */
export const DEFAULT_GLOBE_ZOOM = 1.5;

/** Zoom level for event focus */
export const EVENT_FOCUS_ZOOM = 4;

// =============================================================================
// POLLING & REFRESH INTERVALS
// =============================================================================

/** How often to poll for new events (ms) */
export const EVENTS_POLL_INTERVAL_MS = 60000; // 60 seconds

/** How often to update relative timestamps in the UI (ms) */
export const TIME_DISPLAY_UPDATE_MS = 30000; // 30 seconds

// =============================================================================
// REACTION / ANALYST PROTOCOL THRESHOLDS
// =============================================================================

/** Percentage threshold for consensus (0.6 = 60%) */
export const CONSENSUS_THRESHOLD = 0.6;

/** Minimum votes required before declaring a consensus */
export const MIN_VOTES_FOR_CONSENSUS = 3;

/**
 * Minimum votes required for "hot" badge.
 *
 * TODO: Review this algorithm. Currently just a simple threshold.
 * Consider more sophisticated approaches:
 * - Velocity-based: X reactions in last Y hours
 * - Relative: Top 10% of events by reaction count
 * - Weighted: Critical votes count more than noise
 * - Recency decay: Recent reactions weighted higher
 * - Trending (Reddit/HN style): Balance recency + engagement
 */
export const HOT_EVENT_MIN_VOTES = 5;

/** Maximum severity boost from critical consensus */
export const MAX_SEVERITY_BOOST = 2;

// =============================================================================
// RATE LIMITING
// =============================================================================

/** Maximum AI briefing messages per IP per day */
export const DAILY_BRIEFING_LIMIT = 10;

/** Maximum briefing requests globally per minute (across all IPs) */
export const GLOBAL_BRIEFING_LIMIT_PER_MINUTE = 30;

/**
 * Proof of Work difficulty (number of leading zero bits required)
 *
 * Higher = more computation required:
 * - 16 bits: ~65K hashes, ~100-200ms
 * - 18 bits: ~262K hashes, ~300-600ms
 * - 20 bits: ~1M hashes, ~1-2s
 *
 * 16 bits = ~65k hashes, solves in 1-2 sec on most devices.
 * 18 was too slow for mobile/edge users.
 */
export const POW_DIFFICULTY = 16;

/** Session token validity (ms) - how long a solved PoW grants access */
export const SESSION_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/** Maximum question length (characters) */
export const MAX_QUESTION_LENGTH = 2000;

// Note: Chat history length is not enforced server-side.
// Gemini models have 1M+ token limits, and we handle context length
// errors gracefully in the briefing API if limits are exceeded.

// =============================================================================
// AI BRIEFING SETTINGS
// =============================================================================

/** Maximum tool call iterations per briefing request */
export const BRIEFING_MAX_ITERATIONS = 3;

/** Maximum web searches per briefing request */
export const BRIEFING_MAX_SEARCHES = 2;

/** Default Gemini model for Pro tier users */
export const BRIEFING_MODEL_PRO = "gemini-2.5-flash";

/** Default Gemini model for Free tier users */
export const BRIEFING_MODEL_FREE = "gemini-2.0-flash-lite";

// =============================================================================
// UI CONSTANTS
// =============================================================================

/** Maximum events to keep in session history */
export const MAX_SESSION_EVENTS = 50;

/**
 * Pixel size of the generated Mapbox notification badge icons.
 * Used by symbol layers (`icon-size`) to scale the badge to match bubble radii.
 */
export const NOTIFICATION_BADGE_ICON_PX = 128;

/** Maximum toasts to show at once */
export const MAX_TOAST_COUNT = 3;

/** Minimum severity for toast notification */
export const TOAST_SEVERITY_THRESHOLD = 6;

// =============================================================================
// TIME FILTERING
// =============================================================================

/**
 * Time range options for the filter slider.
 * Used by Dashboard and MobileLayout to filter events by age.
 * The slider dynamically adjusts to only show ranges that have data.
 */
export const TIME_RANGES = [
  { label: "1H", hours: 1 },
  { label: "3H", hours: 3 },
  { label: "6H", hours: 6 },
  { label: "12H", hours: 12 },
  { label: "24H", hours: 24 },
  { label: "3D", hours: 72 },
  { label: "1W", hours: 168 },
  { label: "2W", hours: 336 },
  { label: "1M", hours: 720 },
  { label: "3M", hours: 2160 },
  { label: "6M", hours: 4320 },
  { label: "1Y", hours: 8760 },
] as const;

export type TimeRange = (typeof TIME_RANGES)[number];

/** Minimum number of time range options to show in the slider */
export const MIN_TIME_RANGE_OPTIONS = 5;

// =============================================================================
// SORT OPTIONS
// =============================================================================

/**
 * Sort options for event feeds.
 * Used by both desktop sidebar and mobile filter bar.
 *
 * Ordered as "opposite ends": What's New / Hot / Sev / Old / New
 */
export const SORT_OPTIONS = [
  {
    value: "unread",
    label: "What's New",
    shortLabel: "Whats New",
    mobileLabel: "",
    isPulsing: true,
    tooltip: "Events added since your last visit",
  },
  {
    value: "hot",
    label: "Hot",
    shortLabel: "🔥 Hot",
    mobileLabel: "🔥",
    tooltip: "Trending based on sources, recency, severity & reactions",
  },
  {
    value: "severity",
    label: "Severity",
    shortLabel: "☢️ Sev",
    mobileLabel: "☢️",
    tooltip: "Highest severity events first",
  },
  {
    value: "reactions",
    label: "Reactions",
    shortLabel: "💬 Reax",
    mobileLabel: "💬",
    tooltip: "Most reactions from analysts",
  },
  {
    value: "oldest",
    label: "Oldest",
    shortLabel: "Old",
    mobileLabel: "Old",
    tooltip: "Oldest events first",
  },
  {
    value: "recent",
    label: "Recent",
    shortLabel: "New",
    mobileLabel: "New",
    tooltip: "Most recent events first",
  },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

// =============================================================================
// CLUSTERING
// =============================================================================

/** Max zoom level for clustering (above this, clusters break into points) */
export const CLUSTER_MAX_ZOOM = 8;

/** Cluster radius in pixels */
export const CLUSTER_RADIUS = 60;

/** Precision for location grouping (roughly ~1km) */
export const LOCATION_PRECISION = 100;

// =============================================================================
// LOCAL STORAGE KEYS
// =============================================================================

/**
 * Centralized localStorage keys to avoid typos and enable easy refactoring.
 * Used by useNewEvents, useReadHistory, page.tsx (reset), and privacy/page.tsx.
 */
export const STORAGE_KEYS = {
  /** Timestamp of user's last visit (for "What's New" feature) */
  LAST_VISIT: "realpolitik:lastVisit",
  /** Array of event IDs the user has read (for "Unread" tracking) */
  READ_IDS: "realpolitik:readIds",
  /** Push notification preferences (enabled, minSeverity, categories) */
  PUSH_PREFERENCES: "realpolitik:push:preferences",
  /** When user dismissed the install prompt (value: "permanent") */
  INSTALL_PROMPT_DISMISSED: "realpolitik:installPromptDismissed",
  /** When user dismissed the notification prompt (value: "permanent" or "subscribed") */
  NOTIFICATION_PROMPT_DISMISSED: "realpolitik:notificationPromptDismissed",
} as const;
