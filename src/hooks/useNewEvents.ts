"use client";

import { useState, useCallback } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

// Helper to load lastVisit from localStorage (runs once on init)
function loadLastVisit(): Date | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_VISIT);
    return stored ? new Date(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Hook to track "What's New" - events that arrived after the user's last visit.
 * Solves FOMO: "What changed since I was last here?"
 *
 * Storage: Single timestamp in localStorage (~24 bytes)
 *
 * First visit behavior: On the very first visit (no lastVisit stored),
 * ALL events are shown as "new" to give users a full inbox to explore.
 * The timestamp is only saved when the user actually interacts (marks events as read),
 * not on page leave - this prevents race conditions with redirects and navigation.
 */
export function useNewEvents() {
  // Use lazy initialization to avoid setState in effect
  const [lastVisit] = useState<Date | null>(loadLastVisit);
  const isLoaded = true; // Always loaded after initial render since we use lazy init

  // Save the current timestamp - called when user interacts (marks events as read)
  // This replaces the visibilitychange approach which had race conditions
  const saveVisitTimestamp = useCallback(() => {
    try {
      const now = new Date();
      localStorage.setItem(STORAGE_KEYS.LAST_VISIT, now.toISOString());
      // Don't update state - we want current session to keep its "new" markers
      // The new timestamp will be used on the NEXT visit
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Check if an event timestamp is "new" (after last visit)
  const isNew = useCallback(
    (eventTimestamp: string) => {
      if (!lastVisit) return true; // First visit = everything is "new" to you
      return new Date(eventTimestamp) > lastVisit;
    },
    [lastVisit]
  );

  // Get count of new events from a list
  const countNew = useCallback(
    (events: { last_updated?: string; timestamp: string }[]) => {
      return events.filter((e) => isNew(e.last_updated || e.timestamp)).length;
    },
    [isNew]
  );

  return {
    isNew,
    countNew,
    saveVisitTimestamp,
    lastVisit,
    isFirstVisit: isLoaded && lastVisit === null,
    isLoaded,
  };
}
