"use client";

/**
 * useEventLayers - Manages Mapbox event layers
 *
 * This hook orchestrates the map visualization by:
 * 1. Building GeoJSON from events (buildEventGeoJSON)
 * 2. Adding/updating layers with configs (eventLayerConfigs)
 * 3. Handling click interactions
 *
 * @see buildEventGeoJSON.ts - GeoJSON construction
 * @see eventLayerConfigs.ts - Layer styling configurations
 */

import { useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { GeoEvent } from "@/types/events";
import { EnrichedReactionData } from "./useBatchReactions";
import { EventVisualState } from "./useEventStates";
import {
  MAP_PADDING,
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS,
  NOTIFICATION_BADGE_ICON_PX,
} from "@/lib/constants";
import { buildEventGeoJSON } from "./buildEventGeoJSON";
import { EVENT_LAYERS } from "./eventLayerConfigs";

// Re-export for consumers
export { getLocationKey } from "./buildEventGeoJSON";

interface UseEventLayersOptions {
  events: GeoEvent[];
  eventsByLocation: Map<string, GeoEvent[]>;
  onEventClick?: (event: GeoEvent) => void;
  onSingleEventClick: (event: GeoEvent) => void;
  onStackedEventClick: (events: GeoEvent[]) => void;
  recordInteraction: () => void;
  mapReady?: boolean;
  reactions?: Record<string, EnrichedReactionData>;
  eventStateMap?: Map<string, EventVisualState>;
}

const NOTIF_ICON_PIXEL_RATIO = 1;

function createNotificationBadgeImage(): ImageData {
  const size = NOTIFICATION_BADGE_ICON_PX;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);

  const badgeR = size * 0.11;
  const glowR = size * 0.2;

  // Pin to the bubble edge at ~45° (top-right)
  const bubbleR = size * 0.5;
  const maxCenterDistance = (bubbleR - glowR) * Math.SQRT2;
  const desiredCenterDistance = bubbleR - badgeR * 0.5;
  const centerDistance = Math.min(desiredCenterDistance, maxCenterDistance);
  const d = centerDistance / Math.SQRT2;
  const cx = size * 0.5 + d;
  const cy = size * 0.5 - d;

  ctx.clearRect(0, 0, size, size);

  // Simple flat purple dot
  ctx.beginPath();
  ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = "#7c3aed"; // violet-600
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

function createNotificationGlowImage(): ImageData {
  const size = NOTIFICATION_BADGE_ICON_PX;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);

  const badgeR = size * 0.11;
  const ringR = size * 0.22; // Larger ring for visibility

  const bubbleR = size * 0.5;
  const maxCenterDistance = (bubbleR - ringR) * Math.SQRT2;
  const desiredCenterDistance = bubbleR - badgeR * 0.5;
  const centerDistance = Math.min(desiredCenterDistance, maxCenterDistance);
  const d = centerDistance / Math.SQRT2;
  const cx = size * 0.5 + d;
  const cy = size * 0.5 - d;

  ctx.clearRect(0, 0, size, size);

  // Outer glow effect
  ctx.save();
  ctx.shadowColor = "#7c3aed";
  ctx.shadowBlur = size * 0.1;
  ctx.strokeStyle = "#7c3aed"; // Solid violet-600
  ctx.lineWidth = size * 0.04; // Thicker ring
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  return ctx.getImageData(0, 0, size, size);
}

function ensureNotificationImages(map: mapboxgl.Map) {
  // Images are tied to the active style; if the style reloads, they must be re-added.
  const safeUpsert = (name: string, make: () => ImageData) => {
    const image = make();

    // Prefer in-place update (keeps layer references intact).
    if (
      map.hasImage(name) &&
      typeof (map as unknown as { updateImage?: unknown }).updateImage === "function"
    ) {
      try {
        (map as unknown as { updateImage: (n: string, img: ImageData) => void }).updateImage(
          name,
          image
        );
        return;
      } catch {
        // fall through to remove+add
      }
    }

    try {
      if (map.hasImage(name)) map.removeImage(name);
    } catch {
      // ignore
    }

    map.addImage(name, image, { pixelRatio: NOTIF_ICON_PIXEL_RATIO });
  };

  safeUpsert("notif-badge", createNotificationBadgeImage);
  safeUpsert("notif-glow", createNotificationGlowImage);
}

/**
 * Hook to manage Mapbox event layers (source, circles, clustering).
 * Handles adding/updating layers and click handlers.
 */
export function useEventLayers(
  mapRef: React.MutableRefObject<mapboxgl.Map | null>,
  options: UseEventLayersOptions
) {
  const {
    events,
    eventsByLocation,
    onSingleEventClick,
    onStackedEventClick,
    recordInteraction,
    mapReady,
    reactions = {},
    eventStateMap,
  } = options;

  const layersAdded = useRef(false);

  // Use refs to store values so click handlers always access the latest
  // This fixes stale closure issues when filters change (click handlers are registered once)
  const eventsByLocationRef = useRef(eventsByLocation);
  const onSingleEventClickRef = useRef(onSingleEventClick);
  const onStackedEventClickRef = useRef(onStackedEventClick);

  useEffect(() => {
    eventsByLocationRef.current = eventsByLocation;
  }, [eventsByLocation]);

  useEffect(() => {
    onSingleEventClickRef.current = onSingleEventClick;
  }, [onSingleEventClick]);

  useEffect(() => {
    onStackedEventClickRef.current = onStackedEventClick;
  }, [onStackedEventClick]);

  // Build GeoJSON from events (memoized via useCallback)
  const getGeoJSON = useCallback(() => {
    return buildEventGeoJSON({ events, eventsByLocation, reactions, eventStateMap });
  }, [events, eventsByLocation, reactions, eventStateMap]);

  // Start the pulsing animation for critical events and notification dots
  // Also handles distance-based scaling for edge markers
  const startPulseAnimation = useCallback((map: mapboxgl.Map) => {
    let pulsePhase = 0;

    // Notification glow layers (symbol icons)
    const glowLayers = ["events-notification-glow", "cluster-notification-glow"];

    const animatePulse = () => {
      const hasCriticalLayer = map.getLayer("events-critical-pulse");
      const hasAnyGlow = glowLayers.some((id) => map.getLayer(id));

      if (!hasCriticalLayer && !hasAnyGlow) return;

      pulsePhase = (pulsePhase + 0.06) % (Math.PI * 2);
      const pulseValue = (Math.sin(pulsePhase) + 1) / 2; // 0 to 1

      // Critical pulse animation (white ring)
      if (hasCriticalLayer) {
        const criticalOpacity = 0.3 + pulseValue * 0.6;
        map.setPaintProperty("events-critical-pulse", "circle-stroke-opacity", criticalOpacity);
        const criticalStrokeWidth = 1.5 + pulseValue * 1.5;
        map.setPaintProperty("events-critical-pulse", "circle-stroke-width", criticalStrokeWidth);
      }

      // Notification ring pulse - obvious pulsing effect for incoming events
      const notificationPulse = (Math.sin(pulsePhase * 1.2) + 1) / 2; // Slower for visibility
      const glowOpacity = 0.4 + notificationPulse * 0.6; // Range: 0.4 to 1.0

      // Animate glow ring opacity for pulsing effect
      for (const layerId of glowLayers) {
        if (map.getLayer(layerId)) {
          map.setPaintProperty(layerId, "icon-opacity", glowOpacity);
        }
      }

      requestAnimationFrame(animatePulse);
    };

    requestAnimationFrame(animatePulse);
  }, []);

  // Setup click handlers for clusters and events
  const setupClickHandlers = useCallback(
    (map: mapboxgl.Map) => {
      // Click handler for clusters - zoom in until they break apart
      map.on("click", "clusters", (e) => {
        if (!e.features?.[0]) return;

        const feature = e.features[0];
        const clusterId = feature.properties?.cluster_id;
        const source = map.getSource("events") as mapboxgl.GeoJSONSource;

        if (!clusterId || !source) return;

        source.getClusterExpansionZoom(clusterId, (err, expansionZoom) => {
          if (err) return;

          const targetZoom = Math.min((expansionZoom ?? 4) + 0.5, 12);

          map.flyTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: targetZoom,
            duration: 600,
            padding: MAP_PADDING,
          });

          recordInteraction();
        });
      });

      // Double-click on cluster zooms in
      map.on("dblclick", "clusters", (e) => {
        if (!e.features?.[0]) return;
        e.preventDefault();

        const feature = e.features[0];
        const clusterId = feature.properties?.cluster_id;
        const source = map.getSource("events") as mapboxgl.GeoJSONSource;

        if (!clusterId || !source) return;

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (!err) {
            map.easeTo({
              center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
              zoom: zoom ?? 4,
              duration: 500,
              padding: MAP_PADDING,
            });
          }
        });
      });

      // Click handler for event circles
      map.on("click", "events-circles", (e) => {
        if (!e.features?.[0]) return;

        const props = e.features[0].properties;
        if (!props) return;

        const locationKey = props.locationKey;
        // Use refs to get latest values (fixes stale closure - handlers are registered once)
        const eventsAtLocation = eventsByLocationRef.current.get(locationKey) || [];

        if (eventsAtLocation.length > 1) {
          // Use ref for latest callback
          onStackedEventClickRef.current(eventsAtLocation);
        } else if (eventsAtLocation.length === 1) {
          // Use the actual event from the filtered list (has full data including sources)
          onSingleEventClickRef.current(eventsAtLocation[0]);
        } else {
          // Fallback: event is on map but not in current filter (shouldn't happen normally)
          // Reconstruct from feature properties
          const event: GeoEvent = {
            id: props.id,
            title: props.title,
            category: props.category,
            severity: props.severity,
            summary: props.summary,
            timestamp: props.timestamp,
            fallout_prediction: props.fallout_prediction,
            location_name: props.location_name,
            source_url: props.source_url || undefined,
            source_name: props.source_name || undefined,
            coordinates: (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number],
            sources: [],
          };
          onSingleEventClickRef.current(event);
        }

        recordInteraction();
      });

      // Cursor styles
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "events-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "events-circles", () => {
        map.getCanvas().style.cursor = "";
      });
    },
    // Note: onSingleEventClick/onStackedEventClick are accessed via refs, so not needed as deps
    [recordInteraction]
  );

  // Setup layers (called once when map is ready)
  const setupLayers = useCallback(
    (map: mapboxgl.Map, geojson: GeoJSON.FeatureCollection) => {
      // Check if source already exists (might have been recreated)
      const existingSource = map.getSource("events") as mapboxgl.GeoJSONSource | undefined;

      // Ensure notification badge icons exist before any layer tries to render them.
      ensureNotificationImages(map);

      if (layersAdded.current && existingSource) {
        // Just update the data if layers already exist
        existingSource.setData(geojson);
        return;
      }

      // If layers were marked as added but source doesn't exist, reset
      if (layersAdded.current && !existingSource) {
        layersAdded.current = false;
      }

      // Add source with Mapbox clustering + aggregated properties
      map.addSource("events", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: CLUSTER_MAX_ZOOM,
        clusterRadius: CLUSTER_RADIUS,
        clusterProperties: {
          maxSeverity: ["max", ["get", "severity"]],
          militaryCount: ["+", ["case", ["==", ["get", "category"], "MILITARY"], 1, 0]],
          diplomacyCount: ["+", ["case", ["==", ["get", "category"], "DIPLOMACY"], 1, 0]],
          economyCount: ["+", ["case", ["==", ["get", "category"], "ECONOMY"], 1, 0]],
          unrestCount: ["+", ["case", ["==", ["get", "category"], "UNREST"], 1, 0]],
          incomingCount: ["+", ["case", ["==", ["get", "isIncoming"], true], 1, 0]],
          unreadCount: ["+", ["case", ["==", ["get", "isUnread"], true], 1, 0]],
        },
      });

      // Add all layers from config
      for (const { id, config } of EVENT_LAYERS) {
        map.addLayer({
          id,
          source: "events",
          ...config,
        } as mapboxgl.LayerSpecification);
      }

      // Start pulse animation for critical events
      startPulseAnimation(map);

      // Setup click handlers
      setupClickHandlers(map);

      layersAdded.current = true;
    },
    [startPulseAnimation, setupClickHandlers]
  );

  // Effect to add/update layers when events change or map becomes ready
  useEffect(() => {
    const map = mapRef.current;

    if (!map || !mapReady) {
      return;
    }

    const geojson = getGeoJSON();

    // mapReady is set AFTER style.load fires, so if mapReady is true,
    // we can safely set up layers. Use requestAnimationFrame to ensure
    // we're on the next frame
    const rafId = requestAnimationFrame(() => {
      setupLayers(map, geojson);
    });

    return () => cancelAnimationFrame(rafId);
  }, [mapRef, getGeoJSON, setupLayers, mapReady]);

  // Reset layers added flag when component unmounts
  useEffect(() => {
    return () => {
      layersAdded.current = false;
    };
  }, []);
}
