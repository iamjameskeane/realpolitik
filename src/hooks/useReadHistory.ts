"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";
import * as userState from "@/lib/userState";

// Load raw IDs from localStorage (no pruning)
function loadStoredIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.READ_IDS) || "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Hook to track "Read" events - which events the user has clicked on.
 * Solves Cognitive Load: "Which of these 50 dots did I already check?"
 *
 * Storage: Array of event IDs in localStorage, pruned on load to only include
 * events that still exist in the current feed. Bounded by feed size (~3KB max).
 */
export function useReadHistory(currentEventIds: string[]) {
  const { user } = useAuth();
  
  // Memoize the current IDs set for efficient lookups
  const currentIdsSet = useMemo(() => new Set(currentEventIds), [currentEventIds]);

  // Use lazy initialization to load from localStorage once
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set(loadStoredIds()));
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from backend on mount (if signed in)
  useEffect(() => {
    if (!user) {
      setIsLoaded(true);
      return;
    }

    userState.getUserReadEvents(user.id).then((backendReadIds) => {
      setReadIds(backendReadIds);
      // Also sync to localStorage for offline access
      try {
        localStorage.setItem(STORAGE_KEYS.READ_IDS, JSON.stringify([...backendReadIds]));
      } catch {
        // Ignore storage errors
      }
      setIsLoaded(true);
    });
  }, [user]);

  // Prune computation (memoized) - removes IDs that no longer exist in feed
  // Note: Pruning localStorage is deferred to markAsRead to avoid side effects during render
  const prunedReadIds = useMemo(() => {
    if (currentEventIds.length === 0) return readIds;
    return new Set([...readIds].filter((id) => currentIdsSet.has(id)));
  }, [readIds, currentEventIds, currentIdsSet]);

  // Persist to localStorage whenever readIds changes (after initial load)
  const persistReadIds = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEYS.READ_IDS, JSON.stringify([...ids]));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Mark a single event as read
  const markAsRead = useCallback(
    (eventId: string) => {
      setReadIds((prev) => {
        if (prev.has(eventId)) return prev; // Already read
        const next = new Set(prev);
        next.add(eventId);
        persistReadIds(next);
        // Also save to backend if signed in
        if (user) {
          userState.markEventAsRead(user.id, eventId);
        }
        return next;
      });
    },
    [persistReadIds, user]
  );

  // Mark multiple events as read (for "Catch Up" completion)
  const markAllAsRead = useCallback(
    (eventIds: string[]) => {
      setReadIds((prev) => {
        const next = new Set([...prev, ...eventIds]);
        persistReadIds(next);
        // Also save to backend if signed in
        if (user) {
          userState.markEventsAsRead(user.id, eventIds);
        }
        return next;
      });
    },
    [persistReadIds, user]
  );

  // Check if an event is read (uses pruned set)
  const isRead = useCallback((eventId: string) => prunedReadIds.has(eventId), [prunedReadIds]);

  return {
    readIds: prunedReadIds,
    isRead,
    markAsRead,
    markAllAsRead,
    isLoaded,
  };
}
