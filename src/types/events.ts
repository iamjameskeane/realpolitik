import type { RegionName } from "./notifications";

export type EventCategory = "MILITARY" | "DIPLOMACY" | "ECONOMY" | "UNREST";

export type EventRegion = RegionName | "OTHER";

export interface EventSource {
  id: string;
  headline: string;
  summary: string;
  source_name: string;
  source_url: string;
  timestamp: string; // ISO 8601
}

export interface GeoEvent {
  id: string;
  title: string; // Synthesized headline
  category: EventCategory;
  coordinates: [number, number]; // [lng, lat]
  location_name: string; // Human-readable location, e.g. "Kyiv, Ukraine"
  region?: EventRegion; // Geographic region for filtering (e.g. EUROPE, MIDDLE_EAST)
  severity: number; // 1-10
  summary: string; // Synthesized summary
  timestamp: string; // Earliest source timestamp (ISO 8601)
  last_updated?: string; // Latest source timestamp (ISO 8601)
  fallout_prediction: string; // Synthesized with full context
  sources: EventSource[]; // All contributing sources
  // Legacy fields for backwards compatibility
  source_url?: string;
  source_name?: string;
}

export const CATEGORY_DESCRIPTIONS: Record<EventCategory, string> = {
  MILITARY: "Armed conflict, troop movements, weapons, defense operations",
  DIPLOMACY: "Treaties, summits, negotiations, international relations",
  ECONOMY: "Sanctions, trade, markets, financial policy",
  UNREST: "Protests, riots, civil disorder, political instability",
};

export const CATEGORY_COLORS: Record<EventCategory, string> = {
  MILITARY: "#ef4444", // red-500
  DIPLOMACY: "#22d3ee", // cyan-400
  ECONOMY: "#34d399", // emerald-400
  UNREST: "#fbbf24", // amber-400
};

export const CATEGORY_RGB: Record<EventCategory, [number, number, number]> = {
  MILITARY: [239, 68, 68],
  DIPLOMACY: [34, 211, 238],
  ECONOMY: [52, 211, 153],
  UNREST: [251, 191, 36],
};
