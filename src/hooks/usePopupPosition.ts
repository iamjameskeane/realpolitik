"use client";

import { useCallback } from "react";
import mapboxgl from "mapbox-gl";
import { GeoEvent } from "@/types/events";

/** Width of the sidebar when open (matches EventsSidebar md:w-80) */
const SIDEBAR_WIDTH = 320;

interface PopupPosition {
  x: number;
  y: number;
}

interface UsePopupPositionOptions {
  /** Whether the sidebar is currently open */
  sidebarOpen?: boolean;
}

interface UsePopupPositionReturn {
  /** Update popup position based on current map state, hide if off-screen */
  updatePopupPosition: () => void;
  /** Calculate bounded popup style (left, top) */
  getPopupStyle: (
    popupPosition: PopupPosition | null,
    popupWidth?: number,
    popupHeight?: number
  ) => { left?: number; top?: number };
}

/**
 * Hook to handle popup positioning relative to map points.
 * Tracks dot position and hides popup when dot goes off-screen.
 */
export function usePopupPosition(
  mapRef: React.MutableRefObject<mapboxgl.Map | null>,
  selectedEventRef: React.MutableRefObject<GeoEvent | null>,
  setSelectedEvent: (event: GeoEvent | null) => void,
  setPopupPosition: (pos: PopupPosition | null) => void,
  options: UsePopupPositionOptions = {}
): UsePopupPositionReturn {
  const { sidebarOpen = false } = options;

  const updatePopupPosition = useCallback(() => {
    const map = mapRef.current;
    const selectedEvent = selectedEventRef.current;
    if (!map || !selectedEvent) return;

    const point = map.project(selectedEvent.coordinates);
    const canvas = map.getCanvas();
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Check if point is off-screen (with some padding)
    const padding = 50;
    if (
      point.x < -padding ||
      point.x > width + padding ||
      point.y < -padding ||
      point.y > height + padding
    ) {
      // Dot is off-screen, hide the popup
      setSelectedEvent(null);
      setPopupPosition(null);
      return;
    }

    setPopupPosition({ x: point.x, y: point.y });
  }, [mapRef, selectedEventRef, setSelectedEvent, setPopupPosition]);

  const getPopupStyle = useCallback(
    (
      popupPosition: PopupPosition | null,
      popupWidth = 340,
      popupHeight = 300
    ): { left?: number; top?: number } => {
      if (!popupPosition) return {};

      // UI element boundaries to avoid overlapping
      const headerHeight = 80; // Top header/logo area
      const activeSidebarWidth = sidebarOpen ? SIDEBAR_WIDTH : 0; // Only account for sidebar when open
      const bottomPadding = 120; // Bottom controls (time slider, legend)
      const leftPadding = 20; // Left edge padding

      let left = popupPosition.x + 15;
      let top = popupPosition.y - popupHeight / 2;

      if (typeof window !== "undefined") {
        const maxRight = window.innerWidth - activeSidebarWidth;
        const maxBottom = window.innerHeight - bottomPadding;

        // If popup would go into the sidebar, flip to left of the dot
        if (left + popupWidth > maxRight) {
          left = popupPosition.x - popupWidth - 15;
        }

        // If still overlapping sidebar (dot is in sidebar area), clamp to max
        if (left + popupWidth > maxRight) {
          left = maxRight - popupWidth;
        }

        // Don't go past left edge
        if (left < leftPadding) {
          left = leftPadding;
        }

        // Don't go above header
        if (top < headerHeight) {
          top = headerHeight;
        }

        // Don't go below bottom controls
        if (top + popupHeight > maxBottom) {
          top = maxBottom - popupHeight;
        }
      }

      return { left, top };
    },
    [sidebarOpen]
  );

  return { updatePopupPosition, getPopupStyle };
}
