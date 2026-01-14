"use client";

import { useMemo, useCallback, useEffect, useRef } from "react";
import { GeoEvent } from "@/types/events";
import { useNewEvents } from "./useNewEvents";
import { useReadHistory } from "./useReadHistory";

/**
 * The 4 visual states of an event, combining "isNew" (time) and "isRead" (interaction):
 *
 * | State      | isNew | isRead | Meaning                          |
 * |------------|-------|--------|----------------------------------|
 * | incoming   | ✓     | ✗      | New & unread - needs attention!  |
 * | processed  | ✓     | ✓      | New but already checked          |
 * | backlog    | ✗     | ✗      | Old but never clicked            |
 * | history    | ✗     | ✓      | Old and already checked          |
 */
export type EventVisualState = "incoming" | "processed" | "backlog" | "history";

/**
 * Combined hook that manages both "What's New" and "Read" states.
 * Provides a unified API for determining event visual states.
 */
export function useEventStates(events: GeoEvent[]) {
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);

  const {
    isNew,
    lastVisit,
    isFirstVisit,
    isLoaded: newEventsLoaded,
    saveVisitTimestamp,
  } = useNewEvents();
  const {
    isRead,
    markAsRead,
    markAllAsRead,
    isLoaded: readHistoryLoaded,
  } = useReadHistory(eventIds);

  // Determine visual state for a single event
  const getEventState = useCallback(
    (event: GeoEvent): EventVisualState => {
      const eventIsNew = isNew(event.last_updated || event.timestamp);
      const eventIsRead = isRead(event.id);

      if (eventIsNew && !eventIsRead) return "incoming";
      if (eventIsNew && eventIsRead) return "processed";
      if (!eventIsNew && !eventIsRead) return "backlog";
      return "history";
    },
    [isNew, isRead]
  );

  // Get all incoming (new + unread) events - "What's New"
  const incomingEvents = useMemo(() => {
    return events.filter((e) => getEventState(e) === "incoming");
  }, [events, getEventState]);

  // Get all unseen events (incoming + backlog) - events with purple dots
  const unseenEvents = useMemo(() => {
    return events.filter((e) => {
      const state = getEventState(e);
      return state === "incoming" || state === "backlog";
    });
  }, [events, getEventState]);

  // Build a map of event ID -> visual state for efficient lookups
  const eventStateMap = useMemo(() => {
    const map = new Map<string, EventVisualState>();
    for (const event of events) {
      map.set(event.id, getEventState(event));
    }
    return map;
  }, [events, getEventState]);

  // Save visit timestamp when user leaves the page (not on every read)
  // This ensures the "new events" detection works correctly across refreshes
  const savedRef = useRef(false);
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Save once when user leaves (tab hidden, app backgrounded, etc.)
      if (document.visibilityState === "hidden" && !savedRef.current) {
        savedRef.current = true;
        saveVisitTimestamp();
      }
    };

    // Also save on beforeunload for tab/window close
    const handleBeforeUnload = () => {
      if (!savedRef.current) {
        savedRef.current = true;
        saveVisitTimestamp();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [saveVisitTimestamp]);

  // Mark individual event as read (visit timestamp is saved on page leave, not here)
  const markAsReadOnly = useCallback(
    (eventId: string) => {
      markAsRead(eventId);
    },
    [markAsRead]
  );

  // Mark all incoming events as read (for "Catch Up All" action)
  // Visit timestamp is saved on page leave, not here
  const markAllIncomingAsRead = useCallback(() => {
    const incomingIds = incomingEvents.map((e) => e.id);
    markAllAsRead(incomingIds);
  }, [incomingEvents, markAllAsRead]);

  // Mark all unseen events as read (for "Mark All Read" in inbox)
  const markAllUnseenAsRead = useCallback(() => {
    const unseenIds = unseenEvents.map((e) => e.id);
    markAllAsRead(unseenIds);
  }, [unseenEvents, markAllAsRead]);

  return {
    // State getters
    getEventState,
    eventStateMap,

    // Incoming events (new + unread) - "What's New" since last visit
    incomingEvents,
    incomingCount: incomingEvents.length,

    // Unseen events (incoming + backlog) - all events with purple dots
    unseenEvents,
    unseenCount: unseenEvents.length,

    // Actions - visit timestamp is saved on page leave separately
    markAsRead: markAsReadOnly,
    markAllAsRead,
    markAllIncomingAsRead,
    markAllUnseenAsRead,

    // Meta
    isFirstVisit,
    lastVisit,
    isLoaded: newEventsLoaded && readHistoryLoaded,
  };
}
