/**
 * Mapbox Layer Configurations for Event Markers
 *
 * Contains all layer definitions (paint, layout) for the event visualization.
 * Extracted from useEventLayers for maintainability and testability.
 */

import type {
  CircleLayerSpecification,
  SymbolLayerSpecification,
  ExpressionSpecification,
} from "mapbox-gl";
import { NOTIFICATION_BADGE_ICON_PX } from "@/lib/constants";
import { CATEGORY_COLORS } from "@/types/events";

// Common expression for dominant category color (used in clusters)
const DOMINANT_CATEGORY_COLOR: ExpressionSpecification = [
  "case",
  [
    ">=",
    ["get", "militaryCount"],
    ["max", ["get", "diplomacyCount"], ["max", ["get", "economyCount"], ["get", "unrestCount"]]],
  ],
  "#ef4444", // Military red
  [">=", ["get", "unrestCount"], ["max", ["get", "diplomacyCount"], ["get", "economyCount"]]],
  "#f59e0b", // Unrest amber
  [">=", ["get", "economyCount"], ["get", "diplomacyCount"]],
  "#22c55e", // Economy green
  "#06b6d4", // Diplomacy cyan
];

// Shared radius expressions so we can size other layers (e.g. notification badges) consistently.
const CLUSTER_CIRCLE_RADIUS: ExpressionSpecification = [
  "step",
  ["get", "point_count"],
  18,
  5,
  24,
  10,
  32,
];

const EVENT_CIRCLE_RADIUS: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  1,
  ["interpolate", ["linear"], ["get", "severity"], 1, 4, 10, 12],
  5,
  ["interpolate", ["linear"], ["get", "severity"], 1, 8, 10, 24],
];

// Type for layer config without id and source
type CircleLayerConfig = Omit<CircleLayerSpecification, "id" | "source">;
type SymbolLayerConfig = Omit<SymbolLayerSpecification, "id" | "source">;

/**
 * Cluster glow layer - subtle ambient glow for depth
 */
export const clusterGlowLayer: CircleLayerConfig = {
  type: "circle",
  filter: ["has", "point_count"],
  paint: {
    "circle-radius": ["step", ["get", "point_count"], 32, 5, 44, 10, 56],
    "circle-color": DOMINANT_CATEGORY_COLOR,
    "circle-opacity": [
      "interpolate",
      ["linear"],
      ["get", "maxSeverity"],
      1,
      0.08,
      5,
      0.12,
      10,
      0.2,
    ],
    "circle-blur": 0.85,
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
    // Smooth transitions when clusters split/merge
    "circle-radius-transition": { duration: 300 },
    "circle-opacity-transition": { duration: 300 },
  },
};

/**
 * Cluster circles - sleek glass effect
 * - Very translucent body with subtle blur
 * - Thin crisp outline
 * - Frosted glass aesthetic
 */
export const clustersLayer: CircleLayerConfig = {
  type: "circle",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": DOMINANT_CATEGORY_COLOR,
    // Very translucent glass body
    "circle-opacity": 0.18,
    "circle-radius": CLUSTER_CIRCLE_RADIUS,
    // Subtle blur for frosted glass effect
    "circle-blur": 0.15,
    // Thin, crisp category-colored outline
    "circle-stroke-width": ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 1.5, 10, 2.5],
    "circle-stroke-color": DOMINANT_CATEGORY_COLOR,
    "circle-stroke-opacity": 0.85,
    // Scale circles with globe perspective
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
    // Smooth transitions when clusters split/merge
    "circle-radius-transition": { duration: 300 },
    "circle-opacity-transition": { duration: 300 },
  },
};

/**
 * Cluster count label - crisp white text with soft shadow
 */
export const clusterCountLayer: SymbolLayerConfig = {
  type: "symbol",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
    "text-size": 13,
    "text-letter-spacing": 0.05,
    // Follow the circle's perspective on the globe
    "text-pitch-alignment": "map",
    "text-rotation-alignment": "map",
  },
  paint: {
    "text-color": "#ffffff",
    // Soft shadow for depth
    "text-halo-color": "rgba(0, 0, 0, 0.6)",
    "text-halo-width": 1.2,
    "text-halo-blur": 0.8,
  },
};

/**
 * Event glow - subtle ambient glow for high-severity events
 */
export const eventsGlowLayer: CircleLayerConfig = {
  type: "circle",
  filter: ["all", ["!", ["has", "point_count"]], [">=", ["get", "severity"], 6]],
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      1,
      ["interpolate", ["linear"], ["get", "severity"], 6, 20, 10, 38],
      5,
      ["interpolate", ["linear"], ["get", "severity"], 6, 38, 10, 75],
    ],
    "circle-color": ["get", "color"],
    "circle-opacity": 0.12,
    "circle-blur": 0.9,
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
    // Smooth transitions when appearing from clusters
    "circle-radius-transition": { duration: 300 },
    "circle-opacity-transition": { duration: 300 },
  },
};

/**
 * Critical consensus pulse ring - animated white ring for critical events
 */
export const eventsCriticalPulseLayer: CircleLayerConfig = {
  type: "circle",
  filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isCriticalConsensus"], true]],
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      1,
      ["interpolate", ["linear"], ["get", "severity"], 1, 14, 10, 24],
      5,
      ["interpolate", ["linear"], ["get", "severity"], 1, 28, 10, 48],
    ],
    "circle-color": "transparent",
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-opacity": 0.7,
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
  },
};

/**
 * Single-category ring - inner glow ring for single-category events
 */
export const eventsRingLayer: CircleLayerConfig = {
  type: "circle",
  filter: ["all", ["!", ["has", "point_count"]], ["!", ["get", "hasMultipleCategories"]]],
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      1,
      ["interpolate", ["linear"], ["get", "severity"], 1, 8, 10, 18],
      5,
      ["interpolate", ["linear"], ["get", "severity"], 1, 16, 10, 36],
    ],
    "circle-color": "transparent",
    "circle-stroke-width": 1.5,
    "circle-stroke-color": ["get", "color"],
    "circle-stroke-opacity": 0.4,
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
  },
};

/**
 * Multi-category ring - Military (outermost)
 */
export const eventsRingMilitaryLayer: CircleLayerConfig = {
  type: "circle",
  filter: [
    "all",
    ["!", ["has", "point_count"]],
    ["get", "hasMultipleCategories"],
    ["get", "hasMilitary"],
  ],
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      1,
      ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 14, 10, 26],
      5,
      ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 28, 10, 52],
    ],
    "circle-color": "transparent",
    "circle-stroke-width": 2,
    "circle-stroke-color": CATEGORY_COLORS.MILITARY,
    "circle-stroke-opacity": 0.6,
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
  },
};

/**
 * Multi-category ring - Unrest
 */
export const eventsRingUnrestLayer: CircleLayerConfig = {
  type: "circle",
  filter: [
    "all",
    ["!", ["has", "point_count"]],
    ["get", "hasMultipleCategories"],
    ["get", "hasUnrest"],
  ],
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      1,
      ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 11, 10, 22],
      5,
      ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 22, 10, 44],
    ],
    "circle-color": "transparent",
    "circle-stroke-width": 2,
    "circle-stroke-color": CATEGORY_COLORS.UNREST,
    "circle-stroke-opacity": 0.6,
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
  },
};

/**
 * Multi-category ring - Economy
 */
export const eventsRingEconomyLayer: CircleLayerConfig = {
  type: "circle",
  filter: [
    "all",
    ["!", ["has", "point_count"]],
    ["get", "hasMultipleCategories"],
    ["get", "hasEconomy"],
  ],
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      1,
      ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 8, 10, 18],
      5,
      ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 16, 10, 36],
    ],
    "circle-color": "transparent",
    "circle-stroke-width": 2,
    "circle-stroke-color": CATEGORY_COLORS.ECONOMY,
    "circle-stroke-opacity": 0.6,
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
  },
};

/**
 * Multi-category ring - Diplomacy (innermost)
 */
export const eventsRingDiplomacyLayer: CircleLayerConfig = {
  type: "circle",
  filter: [
    "all",
    ["!", ["has", "point_count"]],
    ["get", "hasMultipleCategories"],
    ["get", "hasDiplomacy"],
  ],
  paint: {
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      1,
      ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 5, 10, 14],
      5,
      ["interpolate", ["linear"], ["get", "maxSeverity"], 1, 10, 10, 28],
    ],
    "circle-color": "transparent",
    "circle-stroke-width": 2,
    "circle-stroke-color": CATEGORY_COLORS.DIPLOMACY,
    "circle-stroke-opacity": 0.6,
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
  },
};

/**
 * Main event circles - solid dots with noise fade and read fade
 *
 * Opacity hierarchy:
 * - isRead (history/processed): 0.4 (faded - user already checked this)
 * - isNoiseConsensus: 0.5 (faded - analysts say noise)
 * - default: 0.95 (full visibility)
 */
export const eventsCirclesLayer: CircleLayerConfig = {
  type: "circle",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-radius": EVENT_CIRCLE_RADIUS,
    "circle-color": ["get", "color"],
    // Sleek glass effect - very translucent body
    "circle-opacity": [
      "case",
      ["==", ["get", "isRead"], true],
      0.12, // Read events ghost-like
      ["==", ["get", "isNoiseConsensus"], true],
      0.15, // Noise consensus very faded
      0.22, // Default translucent glass
    ],
    // Subtle blur for frosted effect
    "circle-blur": 0.1,
    // Thin, crisp category-colored outline
    "circle-stroke-width": ["case", ["==", ["get", "isRead"], true], 1, 1.5],
    "circle-stroke-color": ["get", "color"],
    "circle-stroke-opacity": [
      "case",
      ["==", ["get", "isRead"], true],
      0.35,
      ["==", ["get", "isNoiseConsensus"], true],
      0.45,
      0.85,
    ],
    // Scale circles with globe perspective
    "circle-pitch-scale": "map",
    "circle-pitch-alignment": "map",
    // Smooth transitions when appearing from clusters
    "circle-radius-transition": { duration: 300 },
    "circle-opacity-transition": { duration: 300 },
  },
};

/**
 * Stack count badge - shows number of events at a location
 */
export const eventsStackCountLayer: SymbolLayerConfig = {
  type: "symbol",
  filter: ["all", ["!", ["has", "point_count"]], [">", ["get", "stackSize"], 1]],
  layout: {
    "text-field": ["get", "stackSize"],
    "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
    "text-size": 10,
    "text-offset": [0.8, -0.8],
    "text-anchor": "center",
    // Follow the circle's perspective on the globe
    "text-pitch-alignment": "map",
    "text-rotation-alignment": "map",
  },
  paint: {
    "text-color": "#ffffff",
    "text-halo-color": "#000000",
    "text-halo-width": 1,
  },
};

/**
 * Notification badges (pinned to bubble edges)
 *
 * We render these as symbol icons (transparent except for the purple badge),
 * sized to the bubble diameter (the *outermost* ring/circle we render). This keeps the badge
 * "attached" as the marker scales/tilts with globe perspective — unlike `circle-translate`,
 * which drifts.
 */
const EVENT_SINGLE_RING_RADIUS_Z1: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "severity"],
  1,
  8,
  10,
  18,
];
const EVENT_SINGLE_RING_RADIUS_Z5: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "severity"],
  1,
  16,
  10,
  36,
];

const EVENT_MULTI_RING_MIL_Z1: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "maxSeverity"],
  1,
  14,
  10,
  26,
];
const EVENT_MULTI_RING_MIL_Z5: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "maxSeverity"],
  1,
  28,
  10,
  52,
];

const EVENT_MULTI_RING_UNREST_Z1: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "maxSeverity"],
  1,
  11,
  10,
  22,
];
const EVENT_MULTI_RING_UNREST_Z5: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "maxSeverity"],
  1,
  22,
  10,
  44,
];

const EVENT_MULTI_RING_ECON_Z1: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "maxSeverity"],
  1,
  8,
  10,
  18,
];
const EVENT_MULTI_RING_ECON_Z5: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "maxSeverity"],
  1,
  16,
  10,
  36,
];

const EVENT_MULTI_RING_DIP_Z1: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "maxSeverity"],
  1,
  5,
  10,
  14,
];
const EVENT_MULTI_RING_DIP_Z5: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["get", "maxSeverity"],
  1,
  10,
  10,
  28,
];

const EVENT_OUTER_RADIUS_Z1: ExpressionSpecification = [
  "case",
  ["get", "hasMultipleCategories"],
  [
    "case",
    ["get", "hasMilitary"],
    EVENT_MULTI_RING_MIL_Z1,
    ["get", "hasUnrest"],
    EVENT_MULTI_RING_UNREST_Z1,
    ["get", "hasEconomy"],
    EVENT_MULTI_RING_ECON_Z1,
    ["get", "hasDiplomacy"],
    EVENT_MULTI_RING_DIP_Z1,
    EVENT_SINGLE_RING_RADIUS_Z1,
  ],
  EVENT_SINGLE_RING_RADIUS_Z1,
];

const EVENT_OUTER_RADIUS_Z5: ExpressionSpecification = [
  "case",
  ["get", "hasMultipleCategories"],
  [
    "case",
    ["get", "hasMilitary"],
    EVENT_MULTI_RING_MIL_Z5,
    ["get", "hasUnrest"],
    EVENT_MULTI_RING_UNREST_Z5,
    ["get", "hasEconomy"],
    EVENT_MULTI_RING_ECON_Z5,
    ["get", "hasDiplomacy"],
    EVENT_MULTI_RING_DIP_Z5,
    EVENT_SINGLE_RING_RADIUS_Z5,
  ],
  EVENT_SINGLE_RING_RADIUS_Z5,
];

const EVENT_NOTIFICATION_BADGE_ICON_SIZE: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  1,
  ["/", ["*", 2, EVENT_OUTER_RADIUS_Z1], NOTIFICATION_BADGE_ICON_PX],
  5,
  ["/", ["*", 2, EVENT_OUTER_RADIUS_Z5], NOTIFICATION_BADGE_ICON_PX],
];

const CLUSTER_NOTIFICATION_BADGE_ICON_SIZE: ExpressionSpecification = [
  "/",
  ["*", 2, CLUSTER_CIRCLE_RADIUS],
  NOTIFICATION_BADGE_ICON_PX,
];

export const clusterNotificationGlowLayer: SymbolLayerConfig = {
  type: "symbol",
  // Glow/pulse only for clusters with NEW incoming events
  filter: ["all", ["has", "point_count"], [">", ["get", "incomingCount"], 0]],
  layout: {
    "icon-image": "notif-glow",
    "icon-size": CLUSTER_NOTIFICATION_BADGE_ICON_SIZE,
    "icon-anchor": "center",
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-pitch-alignment": "map",
    "icon-rotation-alignment": "viewport",
  },
  paint: {
    "icon-opacity": 0.65, // Animated between 0.3-1.0
  },
};

export const clusterNotificationDotLayer: SymbolLayerConfig = {
  type: "symbol",
  // Show purple dot for clusters with ANY unread events (incoming + backlog)
  filter: ["all", ["has", "point_count"], [">", ["get", "unreadCount"], 0]],
  layout: {
    "icon-image": "notif-badge",
    "icon-size": CLUSTER_NOTIFICATION_BADGE_ICON_SIZE,
    "icon-anchor": "center",
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-pitch-alignment": "map",
    "icon-rotation-alignment": "viewport",
  },
  paint: {
    "icon-opacity": 1,
  },
};

export const eventsNotificationGlowLayer: SymbolLayerConfig = {
  type: "symbol",
  // Pulsing ring only for NEW incoming events (not old unread)
  filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isIncoming"], true]],
  layout: {
    "icon-image": "notif-glow",
    "icon-size": EVENT_NOTIFICATION_BADGE_ICON_SIZE,
    "icon-anchor": "center",
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-pitch-alignment": "map",
    "icon-rotation-alignment": "viewport",
  },
  paint: {
    "icon-opacity": 0.65, // Animated between 0.3-1.0
  },
};

export const eventsNotificationDotLayer: SymbolLayerConfig = {
  type: "symbol",
  // Show purple dot for ALL unread events (incoming + backlog)
  filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "isUnread"], true]],
  layout: {
    "icon-image": "notif-badge",
    "icon-size": EVENT_NOTIFICATION_BADGE_ICON_SIZE,
    "icon-anchor": "center",
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-pitch-alignment": "map",
    "icon-rotation-alignment": "viewport",
  },
  paint: {
    "icon-opacity": 1,
  },
};

/**
 * Location labels - city names below event dots
 */
export const eventsLocationLabelsLayer: SymbolLayerConfig = {
  type: "symbol",
  filter: ["!", ["has", "point_count"]],
  minzoom: 3,
  layout: {
    "text-field": ["upcase", ["get", "location_city"]],
    "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
    "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 5, 13, 8, 15],
    "text-letter-spacing": 0.2,
    "text-offset": [0, 2.0],
    "text-anchor": "top",
    "text-max-width": 10,
    "text-allow-overlap": false,
    "text-ignore-placement": false,
    "symbol-sort-key": ["*", -1, ["get", "severity"]],
  },
  paint: {
    "text-color": "#94a3b8",
    "text-halo-color": "rgba(2, 6, 23, 0.8)",
    "text-halo-width": 2,
    "text-halo-blur": 1,
    "text-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 4, 0.85, 5, 1],
  },
};

/**
 * All layer definitions in order (bottom to top)
 */
export const EVENT_LAYERS = [
  { id: "cluster-glow", config: clusterGlowLayer },
  { id: "clusters", config: clustersLayer },
  { id: "cluster-count", config: clusterCountLayer },
  { id: "cluster-notification-glow", config: clusterNotificationGlowLayer },
  { id: "cluster-notification-dot", config: clusterNotificationDotLayer },
  { id: "events-glow", config: eventsGlowLayer },
  { id: "events-critical-pulse", config: eventsCriticalPulseLayer },
  { id: "events-ring", config: eventsRingLayer },
  { id: "events-ring-military", config: eventsRingMilitaryLayer },
  { id: "events-ring-unrest", config: eventsRingUnrestLayer },
  { id: "events-ring-economy", config: eventsRingEconomyLayer },
  { id: "events-ring-diplomacy", config: eventsRingDiplomacyLayer },
  { id: "events-circles", config: eventsCirclesLayer },
  { id: "events-stack-count", config: eventsStackCountLayer },
  { id: "events-notification-glow", config: eventsNotificationGlowLayer },
  { id: "events-notification-dot", config: eventsNotificationDotLayer },
  { id: "events-location-labels", config: eventsLocationLabelsLayer },
] as const;
