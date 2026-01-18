"use client";

import { useState, useCallback, useRef } from "react";
import { GeoEvent } from "@/types/events";

// Distance threshold in degrees - events closer than this are considered "same location"
// ~0.01 degrees is roughly 1km at the equator
const SAME_LOCATION_THRESHOLD = 0.05;

/**
 * Check if two events are at the same or very nearby location
 */
function isSameLocation(a: GeoEvent, b: GeoEvent): boolean {
  const [lng1, lat1] = a.coordinates;
  const [lng2, lat2] = b.coordinates;
  const distance = Math.sqrt(Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2));
  return distance < SAME_LOCATION_THRESHOLD;
}

/**
 * Options for touring mode navigation
 */
export interface TouringModeOptions {
  /** Callback to fly map to an event */
  onFlyToEvent: (event: GeoEvent, options?: { zoom?: number }) => void;
  /** Callback to update URL with event ID */
  onUpdateUrl: (eventId: string | null) => void;
  /** Callback to mark event as read */
  onMarkAsRead: (eventId: string) => void;
  /** Callback to set the selected event ID in parent */
  onSelectEvent: (eventId: string) => void;
  /** Callback when touring mode starts */
  onStart?: () => void;
  /** Callback when touring mode exits */
  onExit?: () => void;
  /** Zoom level for flying to events (default: 7) */
  zoom?: number;
  /** Label for this touring mode (e.g., "catching up", "in flight") */
  label: string;
}

/**
 * Return type for touring mode hook
 */
export interface TouringModeReturn {
  /** Whether touring mode is active */
  isActive: boolean;
  /** Current index in the events array */
  currentIndex: number;
  /** The snapshotted events being toured */
  events: GeoEvent[];
  /** Current event being viewed */
  currentEvent: GeoEvent | undefined;
  /** Start touring with the given events */
  start: (events: GeoEvent[]) => void;
  /** Navigate to next event */
  next: () => void;
  /** Navigate to previous event */
  previous: () => void;
  /** Exit touring mode */
  exit: () => void;
  /** Label for this touring mode */
  label: string;
}

/**
 * Hook to manage a touring mode (catch up, flyover, etc.)
 *
 * Touring mode flies through a list of events one at a time,
 * with next/previous navigation and automatic exit at the end.
 *
 * Usage:
 * ```tsx
 * const catchUp = useTouringMode({
 *   onFlyToEvent: (e) => mapRef.current?.flyToEvent(e),
 *   onUpdateUrl: updateUrlWithEvent,
 *   onMarkAsRead: markAsRead,
 *   onSelectEvent: setSelectedEventId,
 *   onStart: () => { setInboxOpen(false); setSidebarOpen(false); },
 *   label: "catching up",
 * });
 *
 * // Start touring unseen events
 * catchUp.start(unseenEvents);
 * ```
 */
export function useTouringMode(options: TouringModeOptions): TouringModeReturn {
  const {
    onFlyToEvent,
    onUpdateUrl,
    onMarkAsRead,
    onSelectEvent,
    onStart,
    onExit,
    zoom = 7,
    label,
  } = options;

  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [events, setEvents] = useState<GeoEvent[]>([]);
  
  // Track the current event for location comparison
  const currentEventRef = useRef<GeoEvent | null>(null);

  // Navigate to a specific event (internal helper)
  // skipFly: true when events are at the same location (no need to fly)
  const navigateToEvent = useCallback(
    (event: GeoEvent, skipFly?: boolean) => {
      onSelectEvent(event.id);
      onUpdateUrl(event.id);
      onMarkAsRead(event.id);
      if (!skipFly) {
        onFlyToEvent(event, { zoom });
      }
      currentEventRef.current = event;
    },
    [onSelectEvent, onUpdateUrl, onMarkAsRead, onFlyToEvent, zoom]
  );

  // Start touring with the given events
  const start = useCallback(
    (eventsToTour: GeoEvent[]) => {
      if (eventsToTour.length === 0) return;

      // Snapshot events to avoid race conditions
      setEvents([...eventsToTour]);
      setIsActive(true);
      setCurrentIndex(0);

      // Call onStart callback (e.g., close sidebar)
      onStart?.();

      // Navigate to first event (always fly for the first one)
      navigateToEvent(eventsToTour[0], false);
    },
    [navigateToEvent, onStart]
  );

  // Navigate to next event
  const next = useCallback(() => {
    if (events.length === 0) return;

    const nextIndex = currentIndex + 1;

    if (nextIndex >= events.length) {
      // Finished - exit touring mode
      setIsActive(false);
      setCurrentIndex(0);
      setEvents([]);
      currentEventRef.current = null;
      onExit?.();
      return;
    }

    // Check if next event is at the same location - skip fly if so
    const currentEvent = events[currentIndex];
    const nextEvent = events[nextIndex];
    const skipFly = isSameLocation(currentEvent, nextEvent);

    // Move to next event
    setCurrentIndex(nextIndex);
    navigateToEvent(nextEvent, skipFly);
  }, [currentIndex, events, navigateToEvent, onExit]);

  // Navigate to previous event
  const previous = useCallback(() => {
    if (currentIndex <= 0 || events.length === 0) return;

    const prevIndex = currentIndex - 1;
    
    // Check if previous event is at the same location - skip fly if so
    const currentEvent = events[currentIndex];
    const prevEvent = events[prevIndex];
    const skipFly = isSameLocation(currentEvent, prevEvent);
    
    setCurrentIndex(prevIndex);
    navigateToEvent(prevEvent, skipFly);
  }, [currentIndex, events, navigateToEvent]);

  // Exit touring mode
  const exit = useCallback(() => {
    setIsActive(false);
    setCurrentIndex(0);
    setEvents([]);
    currentEventRef.current = null;
    onExit?.();
  }, [onExit]);

  return {
    isActive,
    currentIndex,
    events,
    currentEvent: events[currentIndex],
    start,
    next,
    previous,
    exit,
    label,
  };
}
