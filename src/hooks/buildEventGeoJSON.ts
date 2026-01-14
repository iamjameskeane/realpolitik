/**
 * GeoJSON Builder for Event Markers
 *
 * Transforms GeoEvent[] into a GeoJSON FeatureCollection with properties
 * optimized for Mapbox GL styling (stacking, severity, reactions, etc.)
 */

import { GeoEvent, CATEGORY_COLORS, CATEGORY_RGB } from "@/types/events";
import { EnrichedReactionData } from "./useBatchReactions";
import { LOCATION_PRECISION } from "@/lib/constants";
import { EventVisualState } from "./useEventStates";

// Round coordinates to group nearby events
const roundCoord = (coord: number) => Math.round(coord * LOCATION_PRECISION) / LOCATION_PRECISION;

/**
 * Generate a location key for grouping events at the same position
 */
export const getLocationKey = (coords: [number, number]) =>
  `${roundCoord(coords[0])},${roundCoord(coords[1])}`;

export interface EventFeatureProperties {
  id: string;
  title: string;
  category: string;
  severity: number;
  summary: string;
  timestamp: string;
  fallout_prediction: string;
  location_name: string;
  location_city: string;
  source_url: string;
  source_name: string;
  color: string;
  rgb: [number, number, number];
  stackSize: number;
  locationKey: string;
  // Multi-category properties for stacked events
  hasMilitary: boolean;
  hasDiplomacy: boolean;
  hasEconomy: boolean;
  hasUnrest: boolean;
  categoryCount: number;
  hasMultipleCategories: boolean;
  maxSeverity: number;
  // Reaction-based properties for styling
  isCriticalConsensus: boolean;
  isNoiseConsensus: boolean;
  isHot: boolean;
  voteCount: number;
  // Visual state (new/read tracking)
  visualState: EventVisualState;
  isIncoming: boolean; // New + unread (pulsing purple)
  isUnread: boolean; // Any unread: incoming OR backlog (solid purple)
  isRead: boolean; // User has clicked (no purple dot)
}

interface BuildGeoJSONOptions {
  events: GeoEvent[];
  eventsByLocation: Map<string, GeoEvent[]>;
  reactions: Record<string, EnrichedReactionData>;
  eventStateMap?: Map<string, EventVisualState>;
}

/**
 * Build a GeoJSON FeatureCollection from events
 *
 * Enriches each event with:
 * - Stacking info (how many events at this location)
 * - Category flags for multi-category styling
 * - Reaction data for consensus styling
 */
export function buildEventGeoJSON({
  events,
  eventsByLocation,
  reactions,
  eventStateMap,
}: BuildGeoJSONOptions): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((event) => {
      const locationKey = getLocationKey(event.coordinates);
      const eventsAtLocation = eventsByLocation.get(locationKey) || [event];
      const stackSize = eventsAtLocation.length;

      // For stacked events, determine which categories are present
      const categoriesAtLocation = new Set(eventsAtLocation.map((e) => e.category));
      const hasMilitary = categoriesAtLocation.has("MILITARY");
      const hasDiplomacy = categoriesAtLocation.has("DIPLOMACY");
      const hasEconomy = categoriesAtLocation.has("ECONOMY");
      const hasUnrest = categoriesAtLocation.has("UNREST");
      const categoryCount = categoriesAtLocation.size;
      const hasMultipleCategories = categoryCount > 1;

      // Calculate max severity at this location for glow sizing
      const maxSeverity = Math.max(...eventsAtLocation.map((e) => e.severity));

      // Extract just the city/town name (before the comma)
      const locationCity = (event.location_name || "").split(",")[0].trim();

      // Get reaction data for this event
      const reaction = reactions[event.id];
      const isCriticalConsensus = reaction?.consensus === "critical";
      const isNoiseConsensus = reaction?.consensus === "noise";
      const isHot = reaction?.isHot || false;
      const voteCount = reaction?.total || 0;

      // Get visual state (new/read tracking)
      const visualState = eventStateMap?.get(event.id) || "backlog";
      const isIncoming = visualState === "incoming"; // New + unread (pulsing)
      const isUnread = visualState === "incoming" || visualState === "backlog"; // Any unread
      const isRead = visualState === "processed" || visualState === "history";

      return {
        type: "Feature" as const,
        properties: {
          id: event.id,
          title: event.title,
          category: event.category,
          severity: event.severity,
          summary: event.summary,
          timestamp: event.timestamp,
          fallout_prediction: event.fallout_prediction,
          location_name: event.location_name || "",
          location_city: locationCity,
          source_url: event.source_url || "",
          source_name: event.source_name || "",
          color: CATEGORY_COLORS[event.category],
          rgb: CATEGORY_RGB[event.category],
          stackSize,
          locationKey,
          // Multi-category properties for stacked events
          hasMilitary,
          hasDiplomacy,
          hasEconomy,
          hasUnrest,
          categoryCount,
          hasMultipleCategories,
          maxSeverity,
          // Reaction-based properties for styling
          isCriticalConsensus,
          isNoiseConsensus,
          isHot,
          voteCount,
          // Visual state (new/read tracking)
          visualState,
          isIncoming,
          isUnread,
          isRead,
        } satisfies EventFeatureProperties,
        geometry: {
          type: "Point" as const,
          coordinates: event.coordinates,
        },
      };
    }),
  };
}
