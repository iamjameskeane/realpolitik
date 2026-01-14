"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import mapboxgl from "mapbox-gl";
import { GeoEvent } from "@/types/events";
import { useAutoRotate } from "@/hooks/useAutoRotate";
import { usePopupPosition } from "@/hooks/usePopupPosition";
import { useEventLayers, getLocationKey } from "@/hooks/useEventLayers";
import { EventPopup } from "@/components/map/EventPopup";
import { MAP_PADDING } from "@/lib/constants";

import "mapbox-gl/dist/mapbox-gl.css";

import { EnrichedReactionData } from "@/hooks/useBatchReactions";
import { EventVisualState } from "@/hooks/useEventStates";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Center on Europe for initial view
const INITIAL_CENTER: [number, number] = [15, 50];

/** Width of the sidebar when open (for padding calculations) */
const SIDEBAR_WIDTH = 320;

interface WorldMapProps {
  events: GeoEvent[];
  onEventClick?: (event: GeoEvent) => void;
  is2DMode?: boolean;
  showPopups?: boolean;
  showControls?: boolean;
  onRequestBriefing?: (event: GeoEvent) => void;
  /** Enable touch/drag interactions (default: true) */
  interactive?: boolean;
  /** Indicates parent has an active selection (disables auto-rotate) */
  hasExternalSelection?: boolean;
  /** Reaction data for events (for map styling) */
  reactions?: Record<string, EnrichedReactionData>;
  /** Event visual states map (incoming/processed/backlog/history) */
  eventStateMap?: Map<string, EventVisualState>;
  /** Whether the sidebar is open (affects fly-to centering) */
  sidebarOpen?: boolean;
  /** External stack control (for catch up mode) - overrides location-based stacking */
  externalStack?: {
    events: GeoEvent[];
    index: number;
    onNext: () => void;
    onPrevious: () => void;
    onClose: () => void;
    label?: string;
  };
}

export interface WorldMapHandle {
  flyToEvent: (event: GeoEvent, options?: { zoom?: number }) => void;
}

export const WorldMap = forwardRef<WorldMapHandle, WorldMapProps>(function WorldMap(
  {
    events,
    onEventClick,
    is2DMode = false,
    showPopups = true,
    showControls = true,
    onRequestBriefing,
    interactive = true,
    hasExternalSelection = false,
    reactions = {},
    eventStateMap,
    sidebarOpen = false,
    externalStack,
  },
  ref
) {
  // Refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapInitialized = useRef(false);
  const selectedEventRef = useRef<GeoEvent | null>(null);

  // State
  const [selectedEvent, setSelectedEvent] = useState<GeoEvent | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [stackedEvents, setStackedEvents] = useState<GeoEvent[]>([]);
  const [stackIndex, setStackIndex] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [externalPopupPosition, setExternalPopupPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isFlying, setIsFlying] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    selectedEventRef.current = selectedEvent;
  }, [selectedEvent]);

  // Group events by location
  const eventsByLocation = useMemo(() => {
    const groups = new Map<string, GeoEvent[]>();
    events.forEach((event) => {
      const key = getLocationKey(event.coordinates);
      const existing = groups.get(key) || [];
      existing.push(event);
      groups.set(key, existing);
    });
    return groups;
  }, [events]);

  // Hooks
  const { startAutoRotate, stopAutoRotate, recordInteraction, lastInteractionRef } = useAutoRotate(
    map,
    selectedEventRef,
    { is2DMode, hasExternalSelection }
  );

  const { updatePopupPosition, getPopupStyle } = usePopupPosition(
    map,
    selectedEventRef,
    setSelectedEvent,
    setPopupPosition,
    { sidebarOpen }
  );

  // Event layer callbacks
  const handleSingleEventClick = useCallback(
    (event: GeoEvent) => {
      setStackedEvents([]);
      setStackIndex(0);
      setSelectedEvent(event);
      if (map.current) {
        const point = map.current.project(event.coordinates);
        setPopupPosition({ x: point.x, y: point.y });
      }
      onEventClick?.(event);
    },
    [onEventClick]
  );

  const handleStackedEventClick = useCallback(
    (eventsAtLocation: GeoEvent[]) => {
      setStackedEvents(eventsAtLocation);
      setStackIndex(0);
      setSelectedEvent(eventsAtLocation[0]);
      if (map.current) {
        const point = map.current.project(eventsAtLocation[0].coordinates);
        setPopupPosition({ x: point.x, y: point.y });
      }
      // Notify parent (for mobile to switch to pilot mode)
      onEventClick?.(eventsAtLocation[0]);
    },
    [onEventClick]
  );

  // Use event layers hook - only run after map is ready
  useEventLayers(map, {
    events,
    eventsByLocation,
    onEventClick,
    onSingleEventClick: handleSingleEventClick,
    onStackedEventClick: handleStackedEventClick,
    recordInteraction,
    mapReady, // Pass mapReady to trigger effect when map is initialized
    reactions, // Pass reaction data for marker styling
    eventStateMap, // Pass event visual states for new/read styling
  });

  // Clear selection when clicking outside
  const handleMapClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!map.current) return;

    const features = map.current.queryRenderedFeatures(e.point, {
      layers: ["events-circles"],
    });

    if (!features || features.length === 0) {
      setSelectedEvent(null);
      setPopupPosition(null);
    }
  }, []);

  // Expose flyToEvent method to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      flyToEvent: (event: GeoEvent, options?: { zoom?: number }) => {
        if (!map.current) return;

        lastInteractionRef.current = Date.now();

        // Stop any existing flyTo animation
        map.current.stop();

        // Hide popup during fly animation
        setIsFlying(true);

        // Use provided zoom, or never zoom OUT from current level (min 4)
        const currentZoom = map.current.getZoom();
        const targetZoom = options?.zoom ?? Math.max(currentZoom, 4);

        // Add right padding when sidebar is open to center event in visible area
        const padding = {
          ...MAP_PADDING,
          right: sidebarOpen ? SIDEBAR_WIDTH : 0,
        };

        map.current.flyTo({
          center: event.coordinates,
          zoom: targetZoom,
          pitch: 45,
          duration: 1500,
          padding,
        });

        // Show popup after fly animation actually completes (more reliable than fixed timeout)
        map.current.once("moveend", () => {
          setIsFlying(false);
          // Only update internal popup state if showPopups is enabled (desktop)
          // Mobile handles selection externally
          if (showPopups) {
            setSelectedEvent(event);
            if (map.current) {
              const point = map.current.project(event.coordinates);
              setPopupPosition({ x: point.x, y: point.y });
            }
          }
        });
      },
    }),
    [lastInteractionRef, showPopups, sidebarOpen]
  );

  // Initialize Mapbox (only once)
  useEffect(() => {
    if (!mapContainer.current || mapInitialized.current) return;
    mapInitialized.current = true;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: INITIAL_CENTER,
      zoom: 1.5,
      pitch: 30,
      bearing: 0,
      projection: "globe",
      antialias: true,
      // Enable/disable user interactions
      interactive: interactive,
      dragRotate: interactive,
      dragPan: interactive,
      scrollZoom: interactive,
      touchZoomRotate: interactive,
      touchPitch: interactive,
      doubleClickZoom: interactive,
    });

    // Set padding to shift effective center up (accounts for bottom UI)
    // This must happen early, before any camera animations
    map.current.setPadding(MAP_PADDING);

    // Also re-apply on load in case it gets reset
    map.current.on("load", () => {
      map.current?.setPadding(MAP_PADDING);
    });

    map.current.on("style.load", () => {
      map.current?.setFog({
        range: [0.5, 10],
        color: "#020617",
        "horizon-blend": 0.03,
        "high-color": "#0f172a",
        "space-color": "#020617",
        "star-intensity": 0.25,
      });
      setMapReady(true);
    });

    // Event listeners
    map.current.on("mousedown", recordInteraction);
    map.current.on("wheel", recordInteraction);
    map.current.on("touchstart", recordInteraction);
    map.current.on("move", updatePopupPosition);
    map.current.on("click", handleMapClick);

    // Only add navigation controls if showControls is true (hide on mobile)
    if (showControls) {
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    }

    const rotateTimer = window.setTimeout(startAutoRotate, 3000);
    const resizeTimer = window.setTimeout(() => {
      map.current?.resize();
      // Re-apply padding after resize to maintain globe centering
      map.current?.setPadding(MAP_PADDING);
    }, 100);

    return () => {
      window.clearTimeout(resizeTimer);
      window.clearTimeout(rotateTimer);
      stopAutoRotate();
      map.current?.remove();
      map.current = null;
      mapInitialized.current = false;
    };
    // Note: This effect should only run once on mount. The callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showControls, interactive]);

  // Effect to switch between 2D and 3D projections
  useEffect(() => {
    // Only run after map is fully ready
    if (!map.current || !mapReady) return;

    const targetProjection = is2DMode ? "mercator" : "globe";

    // Switch projection
    map.current.setProjection(targetProjection);

    // Adjust view for 2D mode
    if (is2DMode) {
      map.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 500,
        padding: MAP_PADDING,
      });
      // Disable fog in 2D mode
      map.current.setFog(null);
    } else {
      map.current.easeTo({
        pitch: 30,
        duration: 500,
        padding: MAP_PADDING,
      });
      // Re-enable fog for globe mode
      map.current.setFog({
        range: [0.5, 10],
        color: "#020617",
        "horizon-blend": 0.03,
        "high-color": "#0f172a",
        "space-color": "#020617",
        "star-intensity": 0.25,
      });
    }
  }, [is2DMode, mapReady]);

  // Track external stack event position on map
  useEffect(() => {
    if (!map.current || !externalStack || !mapReady) {
      setExternalPopupPosition(null);
      return;
    }

    const currentEvent = externalStack.events[externalStack.index];
    if (!currentEvent) {
      setExternalPopupPosition(null);
      return;
    }

    // Update position immediately
    const updatePosition = () => {
      if (!map.current) return;
      const point = map.current.project(currentEvent.coordinates);
      setExternalPopupPosition({ x: point.x, y: point.y });
    };

    updatePosition();

    // Update on map move
    map.current.on("move", updatePosition);
    map.current.on("moveend", updatePosition);

    return () => {
      if (map.current) {
        map.current.off("move", updatePosition);
        map.current.off("moveend", updatePosition);
      }
    };
  }, [externalStack, externalStack?.index, mapReady]);

  // Popup navigation handlers
  const handleClosePopup = useCallback(() => {
    setSelectedEvent(null);
    setPopupPosition(null);
    setStackedEvents([]);
    setStackIndex(0);
  }, []);

  const handlePreviousEvent = useCallback(() => {
    const newIndex = (stackIndex - 1 + stackedEvents.length) % stackedEvents.length;
    const newEvent = stackedEvents[newIndex];
    setStackIndex(newIndex);
    setSelectedEvent(newEvent);

    // Mark as read when navigating to this event
    onEventClick?.(newEvent);

    if (map.current) {
      map.current.easeTo({
        center: newEvent.coordinates,
        duration: 500,
        padding: MAP_PADDING,
      });
      map.current.once("moveend", () => {
        if (map.current) {
          const point = map.current.project(newEvent.coordinates);
          setPopupPosition({ x: point.x, y: point.y });
        }
      });
      recordInteraction();
    }
  }, [stackIndex, stackedEvents, recordInteraction, onEventClick]);

  const handleNextEvent = useCallback(() => {
    const newIndex = (stackIndex + 1) % stackedEvents.length;
    const newEvent = stackedEvents[newIndex];
    setStackIndex(newIndex);
    setSelectedEvent(newEvent);

    // Mark as read when navigating to this event
    onEventClick?.(newEvent);

    if (map.current) {
      map.current.easeTo({
        center: newEvent.coordinates,
        duration: 500,
        padding: MAP_PADDING,
      });
      map.current.once("moveend", () => {
        if (map.current) {
          const point = map.current.project(newEvent.coordinates);
          setPopupPosition({ x: point.x, y: point.y });
        }
      });
      recordInteraction();
    }
  }, [stackIndex, stackedEvents, recordInteraction, onEventClick]);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Popup for selected event (disabled in mobile mode, hidden during fly) */}
      {showPopups && selectedEvent && popupPosition && !externalStack && !isFlying && (
        <EventPopup
          selectedEvent={selectedEvent}
          stackedEvents={stackedEvents}
          stackIndex={stackIndex}
          style={getPopupStyle(popupPosition)}
          onClose={handleClosePopup}
          onPrevious={handlePreviousEvent}
          onNext={handleNextEvent}
          onRequestBriefing={onRequestBriefing}
          stackLabel="events here"
        />
      )}
      {/* External stack popup (catch up mode) - tracks event on map, hidden during fly */}
      {showPopups &&
        externalStack &&
        externalStack.events[externalStack.index] &&
        externalPopupPosition &&
        !isFlying && (
          <EventPopup
            selectedEvent={externalStack.events[externalStack.index]}
            stackedEvents={externalStack.events}
            stackIndex={externalStack.index}
            style={getPopupStyle(externalPopupPosition)}
            onClose={externalStack.onClose}
            onPrevious={externalStack.onPrevious}
            onNext={externalStack.onNext}
            onRequestBriefing={onRequestBriefing}
            stackLabel={externalStack.label || "catching up"}
          />
        )}
    </div>
  );
});
