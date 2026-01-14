"use client";

/**
 * useEvents - SWR-based hook for fetching geopolitical events
 *
 * Features:
 * - Stale-while-revalidate for instant UI with fresh data
 * - Auto-refresh on focus (when user returns to tab)
 * - Configurable polling interval
 * - Deduplication of concurrent requests
 * - Built-in error handling
 * - SSR support via initialEvents parameter
 */

import { useState, useCallback } from "react";
import useSWR from "swr";
import { GeoEvent } from "@/types/events";
import { EVENTS_POLL_INTERVAL_MS } from "@/lib/constants";

// Events URL - configurable via environment variable for production (R2/S3)
const EVENTS_URL = process.env.NEXT_PUBLIC_EVENTS_URL || "/events.json";

// Fetcher function for SWR
async function fetcher(url: string): Promise<GeoEvent[]> {
  // Add cache-busting parameter to bypass CDN cache
  const response = await fetch(`${url}?t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`);
  }
  return response.json();
}

export interface UseEventsReturn {
  /** List of geopolitical events */
  events: GeoEvent[];
  /** Loading state (only true on initial load, not revalidation) */
  isLoading: boolean;
  /** True when revalidating (refresh in progress) */
  isRefreshing: boolean;
  /** Error if fetch failed */
  error: Error | undefined;
  /** Manually trigger a refresh */
  refresh: () => Promise<GeoEvent[] | undefined>;
  /** Timestamp of last successful data update */
  dataUpdatedAt: number | null;
}

/**
 * Hook for fetching and caching geopolitical events
 *
 * Uses SWR for:
 * - Automatic caching and revalidation
 * - Polling every 60 seconds
 * - Revalidation on window focus
 * - Request deduplication
 *
 * @param initialEvents - SSR'd events to use as initial data (avoids loading state)
 */
export function useEvents(initialEvents?: GeoEvent[]): UseEventsReturn {
  // Track when data was last updated
  // With SSR, this will be null briefly until SWR's first revalidation
  const [dataUpdatedAt, setDataUpdatedAt] = useState<number | null>(null);

  const onSuccess = useCallback(() => {
    setDataUpdatedAt(Date.now());
  }, []);

  const { data, error, isLoading, isValidating, mutate } = useSWR<GeoEvent[]>(EVENTS_URL, fetcher, {
    refreshInterval: EVENTS_POLL_INTERVAL_MS,
    revalidateOnFocus: true,
    dedupingInterval: 10000, // Dedupe requests within 10s
    fallbackData: initialEvents || [], // Use SSR data as fallback
    onSuccess,
  });

  return {
    events: data || [],
    isLoading: isLoading && !initialEvents, // Not loading if we have SSR data
    isRefreshing: isValidating && !isLoading,
    error,
    refresh: mutate,
    dataUpdatedAt,
  };
}
