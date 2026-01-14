"use client";

import { useCallback, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { MAP_PADDING, AUTO_ROTATE_DELAY_MS } from "@/lib/constants";

interface UseAutoRotateOptions {
  /** How long to wait before starting rotation (ms) */
  idleTime?: number;
  /** How long to wait before zooming out if idle while zoomed (ms) */
  zoomOutTime?: number;
  /** Zoom level above which rotation pauses */
  zoomThreshold?: number;
  /** Default zoom level to return to */
  defaultZoom?: number;
  /** Whether map is in 2D mode (disables rotation) */
  is2DMode?: boolean;
  /** Whether parent component has an active selection (disables rotation) */
  hasExternalSelection?: boolean;
}

interface UseAutoRotateReturn {
  /** Start the auto-rotation interval */
  startAutoRotate: () => void;
  /** Stop the auto-rotation interval */
  stopAutoRotate: () => void;
  /** Record a user interaction (resets idle timer) */
  recordInteraction: () => void;
  /** Ref to the last interaction timestamp */
  lastInteractionRef: React.MutableRefObject<number>;
}

/**
 * Hook to handle auto-rotation of a Mapbox globe.
 * Pauses when user interacts, zoomed in, or popup is open.
 */
export function useAutoRotate(
  mapRef: React.MutableRefObject<mapboxgl.Map | null>,
  selectedEventRef: React.MutableRefObject<unknown>,
  options: UseAutoRotateOptions = {}
): UseAutoRotateReturn {
  const {
    idleTime = 5000,
    zoomOutTime = AUTO_ROTATE_DELAY_MS,
    zoomThreshold = 2.0,
    defaultZoom = 1.5,
    is2DMode = false,
    hasExternalSelection = false,
  } = options;

  const rotationInterval = useRef<number | null>(null);
  const lastInteractionRef = useRef<number>(0);

  // Initialize the timestamp after mount
  useEffect(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  const recordInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  const startAutoRotate = useCallback(() => {
    if (rotationInterval.current) return;

    rotationInterval.current = window.setInterval(() => {
      const map = mapRef.current;
      if (!map) return;

      // Don't rotate in 2D mode
      if (is2DMode) return;

      // Don't rotate if a card is open (internal or external selection)
      if (selectedEventRef.current || hasExternalSelection) return;

      const currentZoom = map.getZoom();
      const timeSinceInteraction = Date.now() - lastInteractionRef.current;

      // If zoomed in past threshold
      if (currentZoom > zoomThreshold) {
        // After extended idle while zoomed, smoothly zoom out
        if (timeSinceInteraction > zoomOutTime) {
          map.easeTo({
            zoom: defaultZoom,
            duration: 2000,
            padding: MAP_PADDING,
          });
          // Reset interaction time so we don't immediately zoom out again
          lastInteractionRef.current = Date.now() - idleTime;
        }
        return; // Don't rotate while zoomed in
      }

      // Normal rotation at default zoom
      if (timeSinceInteraction > idleTime) {
        const center = map.getCenter();
        map.setCenter([center.lng + 0.1, center.lat]);
      }
    }, 50);
  }, [
    mapRef,
    selectedEventRef,
    idleTime,
    zoomOutTime,
    zoomThreshold,
    defaultZoom,
    is2DMode,
    hasExternalSelection,
  ]);

  const stopAutoRotate = useCallback(() => {
    if (rotationInterval.current) {
      window.clearInterval(rotationInterval.current);
      rotationInterval.current = null;
    }
  }, []);

  return {
    startAutoRotate,
    stopAutoRotate,
    recordInteraction,
    lastInteractionRef,
  };
}
