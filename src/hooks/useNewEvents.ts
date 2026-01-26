"use client";

import { useState, useCallback, useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import * as userState from "@/lib/userState";

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
  const { user } = useAuth();

  // Use lazy initialization to avoid setState in effect
  const [lastVisit, setLastVisit] = useState<Date | null>(loadLastVisit);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from backend on mount (if signed in)
  useEffect(() => {
    if (!user) {
      setIsLoaded(true);
      return;
    }

    userState.getLastVisit(user.id).then((backendLastVisit) => {
      if (backendLastVisit) {
        setLastVisit(backendLastVisit);
        // Also sync to localStorage for offline access
        try {
          localStorage.setItem(STORAGE_KEYS.LAST_VISIT, backendLastVisit.toISOString());
        } catch {
          // Ignore storage errors
        }
      }
      setIsLoaded(true);
    });
  }, [user]);

  // Save the current timestamp - called when user interacts (marks events as read)
  // This replaces the visibilitychange approach which had race conditions
  const saveVisitTimestamp = useCallback(() => {
    try {
      const now = new Date();
      localStorage.setItem(STORAGE_KEYS.LAST_VISIT, now.toISOString());
      // Also save to backend if signed in
      if (user) {
        userState.updateLastVisit(user.id);
      }
      // Don't update state - we want current session to keep its "new" markers
      // The new timestamp will be used on the NEXT visit
    } catch {
      // Ignore storage errors
    }
  }, [user]);

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
