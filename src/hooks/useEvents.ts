"use client";

/**
 * useEvents - Dynamic event fetching with lazy expansion
 *
 * Features:
 * - Starts with 24h of data (fast initial load)
 * - Expands when user slides to larger time range
 * - Never shrinks - keeps cached data when sliding back
 * - Deep link support - fetches individual events on demand
 * - SWR for caching and revalidation
 */

import { useState, useCallback, useMemo, useRef } from "react";
import useSWR from "swr";
import { GeoEvent } from "@/types/events";
import { EVENTS_POLL_INTERVAL_MS } from "@/lib/constants";
import {
  fetchEvents as fetchEventsFromSupabase,
  fetchEvent as fetchEventFromSupabase,
  GeoEventFromDB,
} from "@/lib/supabase";

// Default: fetch 24 hours on initial load
const DEFAULT_HOURS = 24;

/**
 * Transform Supabase event to GeoEvent interface
 */
function transformEvent(event: GeoEventFromDB): GeoEvent {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    coordinates: event.coordinates,
    location_name: event.location_name,
    region: event.region as GeoEvent["region"],
    severity: event.severity,
    summary: event.summary,
    timestamp: event.timestamp,
    last_updated: event.last_updated,
    fallout_prediction: event.fallout_prediction || "",
    sources: event.sources,
  };
}

export interface UseEventsOptions {
  /** Initial events from SSR (optional) */
  initialEvents?: GeoEvent[];
  /** Initial hours to fetch (default: 24) */
  initialHours?: number;
}

export interface UseEventsReturn {
  /** All loaded events (may span multiple time ranges) */
  events: GeoEvent[];
  /** Loading state (initial load only) */
  isLoading: boolean;
  /** True when fetching more data */
  isExpanding: boolean;
  /** True when revalidating */
  isRefreshing: boolean;
  /** Error if fetch failed */
  error: Error | undefined;
  /** Maximum hours currently loaded */
  maxHoursLoaded: number;
  /** Expand to load more hours (call when user slides time range) */
  expandToHours: (hours: number) => Promise<void>;
  /** Fetch a single event by ID (for deep links) */
  fetchEventById: (id: string) => Promise<GeoEvent | null>;
  /** Manually refresh current data */
  refresh: () => Promise<GeoEvent[] | undefined>;
  /** Timestamp of last successful update */
  dataUpdatedAt: number | null;
}

/**
 * Hook for fetching events with lazy time range expansion
 */
export function useEvents(options: UseEventsOptions | GeoEvent[] = {}): UseEventsReturn {
  // Handle legacy signature: useEvents(initialEvents?: GeoEvent[])
  const normalizedOptions: UseEventsOptions = Array.isArray(options)
    ? { initialEvents: options }
    : options;

  const { initialEvents, initialHours = DEFAULT_HOURS } = normalizedOptions;

  // Track the maximum hours we've loaded (expand-only)
  const [maxHoursLoaded, setMaxHoursLoaded] = useState(initialHours);
  const [isExpanding, setIsExpanding] = useState(false);
  const [dataUpdatedAt, setDataUpdatedAt] = useState<number | null>(null);

  // Extra events loaded via deep links (keyed by ID)
  const [extraEvents, setExtraEvents] = useState<Map<string, GeoEvent>>(new Map());

  // Track if we've done initial expansion (for SSR hydration)
  const hasHydrated = useRef(false);

  // SWR cache key based on max hours loaded
  const cacheKey = `supabase:events:hours:${maxHoursLoaded}`;

  // Fetcher function
  const fetcher = useCallback(async (): Promise<GeoEvent[]> => {
    const events = await fetchEventsFromSupabase({ hoursAgo: maxHoursLoaded, limit: 1000 });
    return events.map(transformEvent);
  }, [maxHoursLoaded]);

  const { data, error, isLoading, isValidating, mutate } = useSWR<GeoEvent[]>(cacheKey, fetcher, {
    refreshInterval: EVENTS_POLL_INTERVAL_MS,
    revalidateOnFocus: true,
    dedupingInterval: 10000,
    fallbackData: initialEvents || [],
    onSuccess: () => setDataUpdatedAt(Date.now()),
  });

  // Merge SWR data with extra events from deep links
  const events = useMemo(() => {
    const baseEvents = data || [];
    if (extraEvents.size === 0) return baseEvents;

    const baseIds = new Set(baseEvents.map((e) => e.id));
    const extras = Array.from(extraEvents.values()).filter((e) => !baseIds.has(e.id));

    return [...baseEvents, ...extras].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [data, extraEvents]);

  /**
   * Expand to load more hours of data
   * Only fetches if requested hours > currently loaded hours
   */
  const expandToHours = useCallback(
    async (hours: number) => {
      if (hours <= maxHoursLoaded) return; // Already have this data

      setIsExpanding(true);
      try {
        // Update max hours - this will trigger SWR to refetch with new key
        setMaxHoursLoaded(hours);
        // Force immediate refetch
        await mutate();
      } finally {
        setIsExpanding(false);
      }
    },
    [maxHoursLoaded, mutate]
  );

  /**
   * Fetch a single event by ID (for deep links/notifications)
   */
  const fetchEventById = useCallback(
    async (id: string): Promise<GeoEvent | null> => {
      // Check if already loaded
      const existing = events.find((e) => e.id === id);
      if (existing) return existing;

      // Check extra events cache
      if (extraEvents.has(id)) return extraEvents.get(id)!;

      // Fetch from Supabase
      try {
        const event = await fetchEventFromSupabase(id);
        if (event) {
          const transformed = transformEvent(event);
          setExtraEvents((prev) => new Map(prev).set(id, transformed));
          return transformed;
        }
      } catch (err) {
        console.error("Error fetching event by ID:", err);
      }

      return null;
    },
    [events, extraEvents]
  );

  return {
    events,
    isLoading: isLoading && !initialEvents,
    isExpanding,
    isRefreshing: isValidating && !isLoading && !isExpanding,
    error,
    maxHoursLoaded,
    expandToHours,
    fetchEventById,
    refresh: mutate,
    dataUpdatedAt,
  };
}
