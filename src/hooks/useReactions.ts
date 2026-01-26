/**
 * Hook for managing reactions (Analyst Protocol)
 *
 * Provides optimistic UI updates with rollback on failure.
 * Requires user authentication.
 */

import { useState, useCallback, useEffect } from "react";
import { ReactionType, ReactionCounts } from "@/types/reactions";
import { getSupabaseClient } from "@/lib/supabase";

// Extended counts that includes user's vote (from API)
interface ReactionCountsWithVote extends ReactionCounts {
  userVote?: ReactionType | null;
}

interface UseReactionsOptions {
  eventId: string;
}

interface UseReactionsReturn {
  counts: ReactionCountsWithVote;
  userVote: ReactionType | null;
  isFetching: boolean; // Initial load
  isLoading: boolean; // Voting in progress
  error: string | null;
  vote: (type: ReactionType) => Promise<void>;
  unvote: () => Promise<void>;
}

const DEFAULT_COUNTS: ReactionCountsWithVote = {
  critical: 0,
  market: 0,
  noise: 0,
  total: 0,
  userVote: null,
};

export function useReactions({ eventId }: UseReactionsOptions): UseReactionsReturn {
  const [counts, setCounts] = useState<ReactionCountsWithVote>(DEFAULT_COUNTS);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch counts - reset state when eventId changes
  useEffect(() => {
    let cancelled = false;

    // Reset to loading state immediately when eventId changes
    setCounts(DEFAULT_COUNTS);
    setIsFetching(true);
    setError(null);

    const fetchCounts = async () => {
      try {
        // Get auth session
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const headers: Record<string, string> = {};
        if (session) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const response = await fetch(`/api/reactions?eventId=${eventId}`, { headers });
        if (response.ok && !cancelled) {
          const data = await response.json();
          setCounts(data.counts);
        }
      } catch (err) {
        console.error("[useReactions] Failed to fetch counts:", err);
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    fetchCounts();

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Cast or change a vote
  const vote = useCallback(
    async (type: ReactionType) => {
      if (isLoading) return;

      const previousCounts = { ...counts };
      const previousVote = counts.userVote;

      // Optimistic update
      setCounts((prev) => {
        const updated = { ...prev };

        // If changing vote, decrement old vote
        if (previousVote && previousVote !== type) {
          updated[previousVote] = Math.max(0, updated[previousVote] - 1);
        }

        // If new vote (not just changing), increment
        if (!previousVote || previousVote !== type) {
          updated[type] = updated[type] + 1;
        }

        updated.total = updated.critical + updated.market + updated.noise;
        updated.userVote = type;

        return updated;
      });

      setIsLoading(true);
      setError(null);

      try {
        // Get auth session
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("You must be signed in to vote");
        }

        const response = await fetch("/api/reactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ eventId, type }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to vote");
        }

        const data = await response.json();
        setCounts(data.counts);
      } catch (err) {
        // Rollback on error
        setCounts(previousCounts);
        setError(err instanceof Error ? err.message : "Failed to vote");
      } finally {
        setIsLoading(false);
      }
    },
    [eventId, counts, isLoading]
  );

  // Remove a vote
  const unvote = useCallback(async () => {
    if (isLoading || !counts.userVote) return;

    const previousCounts = { ...counts };

    // Optimistic update
    setCounts((prev) => {
      const updated = { ...prev };
      if (prev.userVote) {
        updated[prev.userVote] = Math.max(0, updated[prev.userVote] - 1);
      }
      updated.total = updated.critical + updated.market + updated.noise;
      updated.userVote = null;
      return updated;
    });

    setIsLoading(true);
    setError(null);

    try {
      // Get auth session
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("You must be signed in to vote");
      }

      const response = await fetch(`/api/reactions?eventId=${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove vote");
      }

      const data = await response.json();
      setCounts(data.counts);
    } catch (err) {
      // Rollback on error
      setCounts(previousCounts);
      setError(err instanceof Error ? err.message : "Failed to remove vote");
    } finally {
      setIsLoading(false);
    }
  }, [eventId, counts, isLoading]);

  return {
    counts,
    userVote: counts.userVote || null,
    isFetching,
    isLoading,
    error,
    vote,
    unvote,
  };
}
