"use client";

/**
 * Batch Reactions Hook (Global State Snapshot)
 *
 * Fetches ALL reaction counts in a single request with SWR caching.
 * This eliminates the per-user polling problem that was causing 900k+ Redis commands.
 *
 * Strategy:
 * - Static SWR key ("/api/reactions") = stable cache across filter changes
 * - No polling (refreshInterval: 0) = no background Redis calls
 * - Revalidate on focus = fresh data when user returns to tab
 * - Edge caching (30s) = multiple users share same Redis call
 *
 * Redis cost: ~2 commands per revalidation (KEYS + pipeline)
 * vs. old: ~50 commands every 30 seconds per user
 */

import { useMemo, createContext, useContext, ReactNode } from "react";
import useSWR from "swr";
import { ReactionType, ReactionCounts, EnrichedReactionData } from "@/types/reactions";
import { CONSENSUS_THRESHOLD, MIN_VOTES_FOR_CONSENSUS, HOT_EVENT_MIN_VOTES } from "@/lib/constants";

// Re-export types for convenience
export type { ReactionCounts, EnrichedReactionData } from "@/types/reactions";

interface BatchReactionsContextValue {
  reactions: Record<string, EnrichedReactionData>;
  isLoading: boolean;
  refetch: () => void;
}

const BatchReactionsContext = createContext<BatchReactionsContextValue | null>(null);

// SWR fetcher
async function fetcher(url: string): Promise<Record<string, ReactionCounts>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch reactions");
  }
  const data = await response.json();
  return data.counts || {};
}

/**
 * Calculate enriched reaction data from raw counts
 */
function enrichReactionData(
  counts: ReactionCounts,
  originalSeverity: number
): EnrichedReactionData {
  const { critical, market, noise, total } = counts;

  // Determine consensus (requires threshold % agreement with min votes)
  let consensus: ReactionType | null = null;
  let consensusPct = 0;

  if (total >= MIN_VOTES_FOR_CONSENSUS) {
    const criticalPct = critical / total;
    const marketPct = market / total;
    const noisePct = noise / total;

    if (criticalPct >= CONSENSUS_THRESHOLD) {
      consensus = "critical";
      consensusPct = criticalPct * 100;
    } else if (marketPct >= CONSENSUS_THRESHOLD) {
      consensus = "market";
      consensusPct = marketPct * 100;
    } else if (noisePct >= CONSENSUS_THRESHOLD) {
      consensus = "noise";
      consensusPct = noisePct * 100;
    }
  }

  // Determine if "hot" (high engagement)
  const isHot = total >= HOT_EVENT_MIN_VOTES;

  // Adjust severity based on consensus
  // Critical consensus: bump up by 1-2 points
  // Noise consensus: reduce visual priority (but don't change actual number)
  let adjustedSeverity = originalSeverity;
  if (consensus === "critical" && total >= MIN_VOTES_FOR_CONSENSUS) {
    adjustedSeverity = Math.min(10, originalSeverity + Math.floor(consensusPct / 50));
  }
  // We don't actually reduce severity for noise - we'll handle that with opacity

  return {
    ...counts,
    consensus,
    consensusPct,
    isHot,
    adjustedSeverity,
  };
}

interface BatchReactionsProviderProps {
  children: ReactNode;
  eventIds: string[];
  eventSeverities: Record<string, number>; // Map of eventId -> severity
}

/**
 * Provider that fetches reactions for all events (global batch)
 *
 * Uses SWR with a static key for optimal caching:
 * - No cache thrashing when user changes filters
 * - No polling = no background Redis calls
 * - Focus-based revalidation = fresh data when user returns
 */
export function BatchReactionsProvider({
  children,
  eventIds,
  eventSeverities,
}: BatchReactionsProviderProps) {
  // Static key - fetches ALL reactions regardless of visible events
  // This ensures cache hits when user changes filters
  const {
    data: rawReactions,
    isLoading,
    mutate,
  } = useSWR<Record<string, ReactionCounts>>("/api/reactions", fetcher, {
    revalidateOnFocus: true, // Refresh when user returns to tab
    revalidateOnReconnect: true, // Refresh if network drops/returns
    refreshInterval: 0, // 🛑 NO POLLING - saves 99% of Redis calls
    dedupingInterval: 5000, // Debounce rapid component mounts
  });

  // Enrich reactions with consensus data (only for visible events)
  const reactions = useMemo(() => {
    const enriched: Record<string, EnrichedReactionData> = {};
    const allReactions = rawReactions || {};

    for (const eventId of eventIds) {
      const raw = allReactions[eventId] || { critical: 0, market: 0, noise: 0, total: 0 };
      const severity = eventSeverities[eventId] || 5;
      enriched[eventId] = enrichReactionData(raw, severity);
    }
    return enriched;
  }, [rawReactions, eventIds, eventSeverities]);

  const value = useMemo(
    () => ({
      reactions,
      isLoading,
      refetch: () => mutate(),
    }),
    [reactions, isLoading, mutate]
  );

  return <BatchReactionsContext.Provider value={value}>{children}</BatchReactionsContext.Provider>;
}

/**
 * Hook to access batch reactions data
 */
export function useBatchReactions() {
  const context = useContext(BatchReactionsContext);
  if (!context) {
    // Return empty data if not wrapped in provider (graceful fallback)
    return {
      reactions: {} as Record<string, EnrichedReactionData>,
      isLoading: false,
      refetch: () => {},
    };
  }
  return context;
}

/**
 * Hook to get reaction data for a specific event
 */
export function useEventReaction(eventId: string) {
  const { reactions, isLoading } = useBatchReactions();
  return {
    data: reactions[eventId] || null,
    isLoading,
  };
}
