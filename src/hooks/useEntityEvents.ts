/**
 * Hook to fetch events for a specific entity
 */

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { EntityEvent } from "@/types/entities";

interface UseEntityEventsOptions {
  entityId: string | null;
  limit?: number;
}

export function useEntityEvents({ entityId, limit = 20 }: UseEntityEventsOptions) {
  const [events, setEvents] = useState<EntityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = useCallback(
    async (offset = 0) => {
      if (!entityId) {
        setEvents([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: rpcError } = await supabase.rpc("get_entity_events", {
          entity_uuid: entityId,
          max_count: limit,
        });

        if (rpcError) throw rpcError;

        if (offset === 0) {
          setEvents(data || []);
        } else {
          setEvents((prev) => [...prev, ...(data || [])]);
        }

        setHasMore((data || []).length === limit);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch events";
        console.error("[useEntityEvents] Error:", errorMessage);
        setError(err instanceof Error ? err : new Error(errorMessage));
      } finally {
        setLoading(false);
      }
    },
    [entityId, limit]
  );

  useEffect(() => {
    fetchEvents(0);
  }, [fetchEvents]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchEvents(events.length);
    }
  }, [loading, hasMore, events.length, fetchEvents]);

  return { events, loading, error, hasMore, loadMore };
}
