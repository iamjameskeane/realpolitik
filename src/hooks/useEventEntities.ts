/**
 * Hook to fetch entities for a specific event
 */

import { useState, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { EventEntity } from "@/types/entities";

export function useEventEntities(eventId: string | null) {
  const [entities, setEntities] = useState<EventEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!eventId) {
      setEntities([]);
      setError(null);
      return;
    }

    const fetchEntities = async () => {
      setLoading(true);
      setError(null);

      try {
        const supabase = getSupabaseClient();
        const { data, error: rpcError } = await supabase.rpc("get_event_entities", {
          event_uuid: eventId,
        });

        if (rpcError) throw rpcError;
        setEntities(data || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch entities";
        console.error("[useEventEntities] Error:", errorMessage);
        setError(err instanceof Error ? err : new Error(errorMessage));
        setEntities([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEntities();
  }, [eventId]);

  return { entities, loading, error };
}
