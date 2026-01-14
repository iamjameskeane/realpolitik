"use client";

/**
 * useEventSelection - Shared event selection and navigation logic
 *
 * This hook manages:
 * - Selected event and its index in the filtered list
 * - Stack navigation (multiple events at the same location)
 * - Location-based grouping
 * - URL deep linking
 * - Navigation between events (next/previous with stack awareness)
 *
 * Used by both Dashboard (desktop) and MobileLayout to eliminate duplicate logic.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { GeoEvent } from "@/types/events";
import { LOCATION_PRECISION } from "@/lib/constants";

// Round coordinates to group nearby events
const roundCoord = (coord: number) => Math.round(coord * LOCATION_PRECISION) / LOCATION_PRECISION;
const getLocationKey = (coords: [number, number]) =>
  `${roundCoord(coords[0])},${roundCoord(coords[1])}`;

interface UseEventSelectionOptions {
  /** Filtered list of events to navigate through */
  filteredEvents: GeoEvent[];
  /** Initial event ID from URL for deep linking */
  initialEventId?: string | null;
  /** All events (for deep linking - event might be outside current filter) */
  allEvents?: GeoEvent[];
  /** Callback when flying to an event */
  onFlyToEvent?: (event: GeoEvent) => void;
  /** Callback when initial event is selected via deep link */
  onInitialEventSelect?: (event: GeoEvent) => void;
}

export interface UseEventSelectionReturn {
  // Selection state
  selectedEvent: GeoEvent | null;
  selectedIndex: number;

  // Stack state (multiple events at same location)
  stackedEvents: GeoEvent[];
  stackIndex: number;

  // Computed values
  eventsByLocation: Map<string, GeoEvent[]>;

  // Actions
  /** Select an event. Pass skipFly=true when clicking directly on map (already visible) */
  selectEvent: (event: GeoEvent, index?: number, skipFly?: boolean) => void;
  selectEventById: (eventId: string) => void;
  clearSelection: () => void;
  navigateNext: () => void;
  navigatePrevious: () => void;

  // For stack navigation display
  isInStack: boolean;
  stackSize: number;
  stackPosition: number; // 1-indexed for display
}

/**
 * Hook for managing event selection with stack-aware navigation
 */
export function useEventSelection({
  filteredEvents,
  initialEventId,
  allEvents,
  onFlyToEvent,
  onInitialEventSelect,
}: UseEventSelectionOptions): UseEventSelectionReturn {
  // Selection state
  const [selectedEvent, setSelectedEvent] = useState<GeoEvent | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Stack state (for events at the same location)
  const [stackedEvents, setStackedEvents] = useState<GeoEvent[]>([]);
  const [stackIndex, setStackIndex] = useState(0);

  // Deep linking tracking
  const initialEventHandled = useRef(false);

  // Track when we just selected an event to prevent immediate deselection
  // This fixes the bug where marking an event as read (via selection) causes it
  // to be filtered out when hideSeen is true, triggering the clearSelection effect
  const justSelectedRef = useRef(false);

  // Group events by location
  const eventsByLocation = useMemo(() => {
    const groups = new Map<string, GeoEvent[]>();
    filteredEvents.forEach((event) => {
      const key = getLocationKey(event.coordinates);
      const existing = groups.get(key) || [];
      existing.push(event);
      groups.set(key, existing);
    });
    return groups;
  }, [filteredEvents]);

  // Update URL with event ID (for sharing)
  const updateUrlWithEvent = useCallback((eventId: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (eventId) {
      url.searchParams.set("event", eventId);
    } else {
      url.searchParams.delete("event");
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Select an event and set up its stack
  // skipFly: true when clicking directly on the map (event is already visible, no need to fly)
  const selectEvent = useCallback(
    (event: GeoEvent, index?: number, skipFly?: boolean) => {
      // Mark that we just selected an event - prevents immediate deselection
      // when the event gets filtered out (e.g., marked as read + hideSeen is on)
      justSelectedRef.current = true;

      // Find index if not provided
      const eventIndex = index ?? filteredEvents.findIndex((e) => e.id === event.id);

      setSelectedEvent(event);
      setSelectedIndex(eventIndex >= 0 ? eventIndex : 0);

      // Populate stack with all events at this location
      const locationKey = getLocationKey(event.coordinates);
      const eventsAtLocation = eventsByLocation.get(locationKey) || [event];
      setStackedEvents(eventsAtLocation);

      // Find position in stack
      const eventStackIndex = eventsAtLocation.findIndex((e) => e.id === event.id);
      setStackIndex(eventStackIndex >= 0 ? eventStackIndex : 0);

      // Update URL for sharing
      updateUrlWithEvent(event.id);

      // Fly to event (unless skipFly is true - e.g., when clicking directly on map)
      if (!skipFly) {
        onFlyToEvent?.(event);
      }
    },
    [filteredEvents, eventsByLocation, updateUrlWithEvent, onFlyToEvent]
  );

  // Select event by ID
  const selectEventById = useCallback(
    (eventId: string) => {
      const event = filteredEvents.find((e) => e.id === eventId);
      if (event) {
        selectEvent(event);
      }
    },
    [filteredEvents, selectEvent]
  );

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedEvent(null);
    setSelectedIndex(0);
    setStackedEvents([]);
    setStackIndex(0);
    updateUrlWithEvent(null);
  }, [updateUrlWithEvent]);

  // Navigate to next event (within stack first, then to next location)
  const navigateNext = useCallback(() => {
    if (filteredEvents.length === 0) return;

    // If we have a stack with multiple events, navigate within it first
    if (stackedEvents.length > 1) {
      const nextStackIndex = stackIndex + 1;
      if (nextStackIndex < stackedEvents.length) {
        // Move to next in stack (no flyTo needed - same location)
        const nextEvent = stackedEvents[nextStackIndex];
        setStackIndex(nextStackIndex);
        setSelectedEvent(nextEvent);
        const globalIndex = filteredEvents.findIndex((e) => e.id === nextEvent.id);
        if (globalIndex !== -1) setSelectedIndex(globalIndex);
        updateUrlWithEvent(nextEvent.id);
        return;
      }
      // Stack exhausted, fall through to next location
    }

    // Move to next location (next event not in current stack)
    const currentLocationKey = selectedEvent ? getLocationKey(selectedEvent.coordinates) : null;
    let nextIndex = (selectedIndex + 1) % filteredEvents.length;
    let nextEvent = filteredEvents[nextIndex];

    // Skip events at the same location
    let attempts = 0;
    while (
      currentLocationKey &&
      getLocationKey(nextEvent.coordinates) === currentLocationKey &&
      attempts < filteredEvents.length
    ) {
      nextIndex = (nextIndex + 1) % filteredEvents.length;
      nextEvent = filteredEvents[nextIndex];
      attempts++;
    }

    // Set up the new location's stack
    const locationKey = getLocationKey(nextEvent.coordinates);
    const eventsAtLocation = eventsByLocation.get(locationKey) || [nextEvent];
    setStackedEvents(eventsAtLocation);
    setStackIndex(0);
    setSelectedIndex(nextIndex);
    setSelectedEvent(eventsAtLocation[0]);
    updateUrlWithEvent(eventsAtLocation[0].id);
    onFlyToEvent?.(eventsAtLocation[0]);
  }, [
    filteredEvents,
    selectedIndex,
    selectedEvent,
    stackedEvents,
    stackIndex,
    eventsByLocation,
    updateUrlWithEvent,
    onFlyToEvent,
  ]);

  // Navigate to previous event (within stack first, then to previous location)
  const navigatePrevious = useCallback(() => {
    if (filteredEvents.length === 0) return;

    // If we have a stack with multiple events, navigate within it first
    if (stackedEvents.length > 1) {
      const prevStackIndex = stackIndex - 1;
      if (prevStackIndex >= 0) {
        // Move to previous in stack (no flyTo needed - same location)
        const prevEvent = stackedEvents[prevStackIndex];
        setStackIndex(prevStackIndex);
        setSelectedEvent(prevEvent);
        const globalIndex = filteredEvents.findIndex((e) => e.id === prevEvent.id);
        if (globalIndex !== -1) setSelectedIndex(globalIndex);
        updateUrlWithEvent(prevEvent.id);
        return;
      }
      // Stack exhausted, fall through to previous location
    }

    // Move to previous location
    const currentLocationKey = selectedEvent ? getLocationKey(selectedEvent.coordinates) : null;
    let prevIndex = (selectedIndex - 1 + filteredEvents.length) % filteredEvents.length;
    let prevEvent = filteredEvents[prevIndex];

    // Skip events at the same location
    let attempts = 0;
    while (
      currentLocationKey &&
      getLocationKey(prevEvent.coordinates) === currentLocationKey &&
      attempts < filteredEvents.length
    ) {
      prevIndex = (prevIndex - 1 + filteredEvents.length) % filteredEvents.length;
      prevEvent = filteredEvents[prevIndex];
      attempts++;
    }

    // Set up the new location's stack (start at last event in stack)
    const locationKey = getLocationKey(prevEvent.coordinates);
    const eventsAtLocation = eventsByLocation.get(locationKey) || [prevEvent];
    setStackedEvents(eventsAtLocation);
    setStackIndex(eventsAtLocation.length - 1);
    setSelectedIndex(prevIndex);
    const lastEvent = eventsAtLocation[eventsAtLocation.length - 1];
    setSelectedEvent(lastEvent);
    updateUrlWithEvent(lastEvent.id);
    onFlyToEvent?.(lastEvent);
  }, [
    filteredEvents,
    selectedIndex,
    selectedEvent,
    stackedEvents,
    stackIndex,
    eventsByLocation,
    updateUrlWithEvent,
    onFlyToEvent,
  ]);

  // Update stack when filters change while an event is selected
  // Update stack when filters change to ensure stack respects timeline/category filters
  // This effect intentionally updates state when filters change - it's a deliberate sync operation
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedEvent) return;

    // If we just selected an event, don't clear it even if it's filtered out.
    // This fixes the bug where marking an event as read (which happens on selection)
    // causes it to be filtered out when hideSeen is true, immediately deselecting it.
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    const locationKey = getLocationKey(selectedEvent.coordinates);
    const newEventsAtLocation = eventsByLocation.get(locationKey) || [];

    // Check if selected event is still in filtered results
    const selectedStillInFilter = newEventsAtLocation.some((e) => e.id === selectedEvent.id);

    if (!selectedStillInFilter) {
      // Selected event was filtered out - clear selection
      clearSelection();
      return;
    }

    // Update stack to only include filtered events at this location
    const newStackIndex = newEventsAtLocation.findIndex((e) => e.id === selectedEvent.id);
    setStackedEvents(newEventsAtLocation);
    setStackIndex(newStackIndex >= 0 ? newStackIndex : 0);

    // Update selected index in filtered list
    const newSelectedIndex = filteredEvents.findIndex((e) => e.id === selectedEvent.id);
    if (newSelectedIndex !== -1) {
      setSelectedIndex(newSelectedIndex);
    }
  }, [eventsByLocation, filteredEvents, selectedEvent, clearSelection]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle initial event from URL (deep linking)
  useEffect(() => {
    if (initialEventHandled.current || !initialEventId) return;

    // Use allEvents if provided, otherwise use filteredEvents
    const eventsToSearch = allEvents || filteredEvents;
    if (eventsToSearch.length === 0) return;

    const event = eventsToSearch.find((e) => e.id === initialEventId);
    if (event) {
      initialEventHandled.current = true;

      // Find index in filtered events
      const index = filteredEvents.findIndex((e) => e.id === initialEventId);

      // Use requestAnimationFrame to batch state updates (avoids lint warning)
      requestAnimationFrame(() => {
        // Set up the event selection
        selectEvent(event, index >= 0 ? index : 0, true); // skipFly=true, we'll fly after delay

        // Notify caller that initial event was selected (for phase changes etc)
        onInitialEventSelect?.(event);

        // Fly to event after a short delay
        setTimeout(() => {
          onFlyToEvent?.(event);
        }, 500);
      });
    }
  }, [initialEventId, filteredEvents, allEvents, selectEvent, onFlyToEvent, onInitialEventSelect]);

  return {
    // Selection state
    selectedEvent,
    selectedIndex,

    // Stack state
    stackedEvents,
    stackIndex,

    // Computed values
    eventsByLocation,

    // Actions
    selectEvent,
    selectEventById,
    clearSelection,
    navigateNext,
    navigatePrevious,

    // Stack info for display
    isInStack: stackedEvents.length > 1,
    stackSize: stackedEvents.length,
    stackPosition: stackIndex + 1,
  };
}
