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
import { useEventLayers, getLocationKey, ClusterData } from "@/hooks/useEventLayers";
import { EventPopup } from "@/components/map/EventPopup";
import { ClusterPopup } from "@/components/map/ClusterPopup";
import { ClusterContextMenu } from "@/components/map/ClusterContextMenu";
import { ClusterTooltip } from "@/components/map/ClusterTooltip";
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
  /** Long press on cluster (mobile) - returns events in cluster and location label */
  onClusterLongPress?: (events: GeoEvent[], locationLabel: string) => void;
  /** Start flyover mode with cluster events (desktop) */
  onClusterFlyover?: (events: GeoEvent[]) => void;
  /** External stack control (for catch up mode) - overrides location-based stacking */
  externalStack?: {
    events: GeoEvent[];
    index: number;
    onNext: () => void;
    onPrevious: () => void;
    onClose: () => void;
    label?: string;
  };
  /** Fetch a single event by ID (for entity modal navigation when event not loaded) */
  fetchEventById?: (id: string) => Promise<GeoEvent | null>;
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
    onClusterLongPress,
    onClusterFlyover,
    externalStack,
    fetchEventById,
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

  // Cluster interaction state (desktop)
  const [clusterPopup, setClusterPopup] = useState<{
    data: ClusterData;
    position: { x: number; y: number };
  } | null>(null);
  const [clusterContextMenu, setClusterContextMenu] = useState<{
    data: ClusterData;
    position: { x: number; y: number };
  } | null>(null);
  const [clusterTooltip, setClusterTooltip] = useState<{
    data: ClusterData;
    position: { x: number; y: number };
  } | null>(null);

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
  // Block auto-rotation when any cluster UI is open (popup, context menu, or tooltip)
  const hasClusterUIOpen =
    clusterPopup !== null || clusterContextMenu !== null || clusterTooltip !== null;

  const { startAutoRotate, stopAutoRotate, recordInteraction, lastInteractionRef } = useAutoRotate(
    map,
    selectedEventRef,
    { is2DMode, hasExternalSelection: hasExternalSelection || hasClusterUIOpen }
  );

  const { updatePopupPosition, getPopupStyle } = usePopupPosition(
    map,
    selectedEventRef,
    setSelectedEvent,
    setPopupPosition,
    { sidebarOpen }
  );

  // Event layer callbacks - fly to event first, then show popup after animation
  const handleSingleEventClick = useCallback(
    (event: GeoEvent) => {
      if (!map.current) return;

      // Clear any existing selection and prepare for fly animation
      setStackedEvents([]);
      setStackIndex(0);
      setSelectedEvent(null);
      setPopupPosition(null);
      setIsFlying(true);

      // Stop any existing animation
      map.current.stop();

      // Notify parent (updates URL, marks as read)
      onEventClick?.(event);

      // Fly to the event
      const currentZoom = map.current.getZoom();
      const targetZoom = Math.max(currentZoom, 4);
      const flyDuration = 1200;

      map.current.flyTo({
        center: event.coordinates,
        zoom: targetZoom,
        pitch: 45,
        duration: flyDuration,
        padding: {
          ...MAP_PADDING,
          right: sidebarOpen ? SIDEBAR_WIDTH : 0,
        },
      });

      // Show popup after animation completes
      setTimeout(() => {
        setIsFlying(false);
        setSelectedEvent(event);
        if (map.current) {
          const point = map.current.project(event.coordinates);
          setPopupPosition({ x: point.x, y: point.y });
        }
      }, flyDuration + 100);
    },
    [onEventClick, sidebarOpen]
  );

  const handleStackedEventClick = useCallback(
    (eventsAtLocation: GeoEvent[]) => {
      if (!map.current) return;

      const firstEvent = eventsAtLocation[0];

      // Clear any existing selection and prepare for fly animation
      setSelectedEvent(null);
      setPopupPosition(null);
      setIsFlying(true);

      // Stop any existing animation
      map.current.stop();

      // Notify parent (updates URL, marks as read)
      onEventClick?.(firstEvent);

      // Fly to the events
      const currentZoom = map.current.getZoom();
      const targetZoom = Math.max(currentZoom, 4);
      const flyDuration = 1200;

      map.current.flyTo({
        center: firstEvent.coordinates,
        zoom: targetZoom,
        pitch: 45,
        duration: flyDuration,
        padding: {
          ...MAP_PADDING,
          right: sidebarOpen ? SIDEBAR_WIDTH : 0,
        },
      });

      // Show popup after animation completes
      setTimeout(() => {
        setIsFlying(false);
        setStackedEvents(eventsAtLocation);
        setStackIndex(0);
        setSelectedEvent(firstEvent);
        if (map.current) {
          const point = map.current.project(firstEvent.coordinates);
          setPopupPosition({ x: point.x, y: point.y });
        }
      }, flyDuration + 100);
    },
    [onEventClick, sidebarOpen]
  );

  // ===== CLUSTER INTERACTION HANDLERS (Desktop) =====

  // Show cluster details popup (shift+click or from context menu)
  const handleClusterShiftClick = useCallback((data: ClusterData) => {
    // Clear any existing popups first
    setSelectedEvent(null);
    setPopupPosition(null);
    setClusterContextMenu(null);
    setClusterTooltip(null);

    // Get position on map for the popup
    if (map.current) {
      const point = map.current.project(data.coordinates);
      setClusterPopup({ data, position: { x: point.x, y: point.y } });
    }
  }, []);

  // Show context menu (right-click)
  const handleClusterRightClick = useCallback(
    (data: ClusterData, cursorPosition: { x: number; y: number }) => {
      // Clear tooltip
      setClusterTooltip(null);
      // Show context menu at cursor position
      setClusterContextMenu({ data, position: cursorPosition });
    },
    []
  );

  // Show/hide tooltip (hover with delay)
  const handleClusterHover = useCallback(
    (data: ClusterData | null, cursorPosition: { x: number; y: number } | null) => {
      // Don't show tooltip if context menu or popup is open
      if (clusterContextMenu || clusterPopup) {
        setClusterTooltip(null);
        return;
      }

      if (data && cursorPosition) {
        setClusterTooltip({ data, position: cursorPosition });
      } else {
        setClusterTooltip(null);
      }
    },
    [clusterContextMenu, clusterPopup]
  );

  // Close cluster popup
  const handleCloseClusterPopup = useCallback(() => {
    setClusterPopup(null);
  }, []);

  // Handle event click from cluster popup - fly to event
  const handleClusterEventClick = useCallback(
    (event: GeoEvent) => {
      if (!map.current) return;

      // Clear everything and set flying state FIRST
      setSelectedEvent(null);
      setPopupPosition(null);
      setClusterPopup(null);
      setIsFlying(true);

      // Stop any existing animation
      map.current.stop();

      // Notify parent to mark as read and update URL
      onEventClick?.(event);

      const currentZoom = map.current.getZoom();
      const targetZoom = Math.max(currentZoom, 4);
      const flyDuration = 1200;

      map.current.flyTo({
        center: event.coordinates,
        zoom: targetZoom,
        pitch: 45,
        duration: flyDuration,
        padding: {
          ...MAP_PADDING,
          right: sidebarOpen ? SIDEBAR_WIDTH : 0,
        },
      });

      // Show popup only after the fly animation completes
      setTimeout(() => {
        setIsFlying(false);
        setSelectedEvent(event);
        if (map.current) {
          const point = map.current.project(event.coordinates);
          setPopupPosition({ x: point.x, y: point.y });
        }
      }, flyDuration + 100);
    },
    [onEventClick, sidebarOpen]
  );

  // Handle event click from entity modal - fly to event by ID
  const handleEntityEventClick = useCallback(
    async (eventId: string) => {
      // First try to find in loaded events
      let event = events.find((e) => e.id === eventId);

      // If not found, fetch from server
      if (!event && fetchEventById) {
        const fetchedEvent = await fetchEventById(eventId);
        if (fetchedEvent) {
          event = fetchedEvent;
        }
      }

      if (!event) {
        console.warn(`[WorldMap] Event ${eventId} not found`);
        return;
      }

      // Validate coordinates
      if (
        !event.coordinates ||
        !Array.isArray(event.coordinates) ||
        event.coordinates.length !== 2 ||
        typeof event.coordinates[0] !== "number" ||
        typeof event.coordinates[1] !== "number"
      ) {
        console.error("[WorldMap] Invalid coordinates for event:", event.id, event.coordinates);
        return;
      }

      handleClusterEventClick(event);
    },
    [events, handleClusterEventClick, fetchEventById]
  );

  // Start flyover from cluster popup
  const handleClusterFlyover = useCallback(() => {
    if (!clusterPopup) return;

    const { events: clusterEvents } = clusterPopup.data;

    // Close popup
    setClusterPopup(null);

    // Trigger flyover mode via parent callback
    if (onClusterFlyover) {
      onClusterFlyover(clusterEvents);
    }
  }, [clusterPopup, onClusterFlyover]);

  // Zoom to cluster (from context menu)
  const handleZoomToCluster = useCallback(() => {
    if (!clusterContextMenu || !map.current) return;

    const { clusterId, coordinates } = clusterContextMenu.data;
    const source = map.current.getSource("events") as mapboxgl.GeoJSONSource;

    if (!source) return;

    source.getClusterExpansionZoom(clusterId, (err, expansionZoom) => {
      if (err || !map.current) return;

      const targetZoom = Math.min((expansionZoom ?? 4) + 0.5, 12);

      map.current.flyTo({
        center: coordinates,
        zoom: targetZoom,
        duration: 600,
        padding: MAP_PADDING,
      });

      recordInteraction();
    });
  }, [clusterContextMenu, recordInteraction]);

  // Start flyover from context menu
  const handleClusterFlyoverFromMenu = useCallback(() => {
    if (!clusterContextMenu) return;

    const { events: clusterEvents } = clusterContextMenu.data;

    // Trigger flyover mode via parent callback
    if (onClusterFlyover) {
      onClusterFlyover(clusterEvents);
    }
  }, [clusterContextMenu, onClusterFlyover]);

  // View details from context menu
  const handleViewDetailsFromMenu = useCallback(() => {
    if (!clusterContextMenu) return;
    handleClusterShiftClick(clusterContextMenu.data);
  }, [clusterContextMenu, handleClusterShiftClick]);

  // Use event layers hook - only run after map is ready
  useEventLayers(map, {
    events,
    eventsByLocation,
    onEventClick,
    onSingleEventClick: handleSingleEventClick,
    onStackedEventClick: handleStackedEventClick,
    onClusterLongPress,
    onClusterRightClick: handleClusterRightClick,
    onClusterShiftClick: handleClusterShiftClick,
    onClusterHover: handleClusterHover,
    recordInteraction,
    mapReady, // Pass mapReady to trigger effect when map is initialized
    reactions, // Pass reaction data for marker styling
    eventStateMap, // Pass event visual states for new/read styling
  });

  // Clear selection when clicking outside
  const handleMapClick = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!map.current) return;

    // Check if clicking on clusters or events
    const clusterFeatures = map.current.queryRenderedFeatures(e.point, {
      layers: ["clusters"],
    });
    const eventFeatures = map.current.queryRenderedFeatures(e.point, {
      layers: ["events-circles"],
    });

    // If clicking on empty space, clear all popups
    if (
      (!clusterFeatures || clusterFeatures.length === 0) &&
      (!eventFeatures || eventFeatures.length === 0)
    ) {
      setSelectedEvent(null);
      setPopupPosition(null);
      setClusterPopup(null);
      setClusterContextMenu(null);
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

        // Check if we're already near the target location (same location optimization)
        // If so, skip the fly animation and show popup immediately
        const currentCenter = map.current.getCenter();
        const [targetLng, targetLat] = event.coordinates;
        const distance = Math.sqrt(
          Math.pow(targetLng - currentCenter.lng, 2) + Math.pow(targetLat - currentCenter.lat, 2)
        );
        const isNearby = distance < 0.05; // ~5km at equator

        if (isNearby) {
          // Already at location - show popup immediately without flying
          setIsFlying(false);
          if (showPopups) {
            setSelectedEvent(event);
            const point = map.current.project(event.coordinates);
            setPopupPosition({ x: point.x, y: point.y });
          }
          return;
        }

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
      // Disable boxZoom so shift+click works for cluster details
      boxZoom: false,
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

  // Track cluster popup position on map (updates when map moves)
  useEffect(() => {
    if (!map.current || !clusterPopup || !mapReady) {
      return;
    }

    const updateClusterPosition = () => {
      if (!map.current || !clusterPopup) return;
      const point = map.current.project(clusterPopup.data.coordinates);
      setClusterPopup((prev) => (prev ? { ...prev, position: { x: point.x, y: point.y } } : null));
    };

    map.current.on("move", updateClusterPosition);
    map.current.on("moveend", updateClusterPosition);

    return () => {
      if (map.current) {
        map.current.off("move", updateClusterPosition);
        map.current.off("moveend", updateClusterPosition);
      }
    };
  }, [clusterPopup?.data.coordinates, mapReady]);

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
          onEntityEventClick={handleEntityEventClick}
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
            onEntityEventClick={handleEntityEventClick}
          />
        )}

      {/* Cluster popup (shift+click on cluster) */}
      {showPopups && clusterPopup && !isFlying && (
        <ClusterPopup
          events={clusterPopup.data.events}
          locationLabel={clusterPopup.data.locationLabel}
          style={getPopupStyle(clusterPopup.position)}
          onClose={handleCloseClusterPopup}
          onEventClick={handleClusterEventClick}
          onStartFlyover={handleClusterFlyover}
        />
      )}

      {/* Cluster context menu (right-click on cluster) */}
      {showPopups && clusterContextMenu && (
        <ClusterContextMenu
          x={clusterContextMenu.position.x}
          y={clusterContextMenu.position.y}
          eventCount={clusterContextMenu.data.events.length}
          onClose={() => setClusterContextMenu(null)}
          onViewDetails={handleViewDetailsFromMenu}
          onZoom={handleZoomToCluster}
          onStartFlyover={handleClusterFlyoverFromMenu}
        />
      )}

      {/* Cluster tooltip (hover with delay) */}
      {showPopups && clusterTooltip && !clusterContextMenu && !clusterPopup && (
        <ClusterTooltip
          x={clusterTooltip.position.x}
          y={clusterTooltip.position.y}
          eventCount={clusterTooltip.data.events.length}
          locationLabel={clusterTooltip.data.locationLabel}
        />
      )}
    </div>
  );
});
