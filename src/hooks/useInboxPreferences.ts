/**
 * Hook for managing user inbox preferences (separate from push notifications)
 *
 * Inbox = synced notification list across all devices
 * Push = browser push notifications on specific devices
 */

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { NotificationRule } from "@/types/notifications";

export interface InboxPreferences {
  enabled: boolean;
  rules: NotificationRule[];
}

const DEFAULT_PREFERENCES: InboxPreferences = {
  enabled: true,
  rules: [
    {
      id: "default",
      name: "All Events",
      enabled: true,
      conditions: [],
    },
  ],
};

export function useInboxPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<InboxPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load preferences from Supabase
  useEffect(() => {
    if (!user) {
      setPreferences(DEFAULT_PREFERENCES);
      setIsLoading(false);
      return;
    }

    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase.rpc("get_inbox_preferences", {
          user_uuid: user.id,
        });

        if (fetchError) throw fetchError;

        if (data) {
          setPreferences(data as InboxPreferences);
        }
      } catch (err) {
        console.error("[Inbox] Failed to load preferences:", err);
        setError("Failed to load inbox preferences");
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user]);

  // Toggle inbox enabled/disabled
  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!user) return;

      const newPrefs = { ...preferences, enabled };
      setPreferences(newPrefs);

      try {
        const supabase = getSupabaseClient();
        await supabase.rpc("update_inbox_preferences", {
          user_uuid: user.id,
          prefs: newPrefs,
        });
      } catch (err) {
        console.error("[Inbox] Failed to update enabled:", err);
        // Revert on error
        setPreferences(preferences);
        setError("Failed to update inbox settings");
      }
    },
    [user, preferences]
  );

  // Update rules
  const updateRules = useCallback(
    async (rules: NotificationRule[]) => {
      if (!user) return;

      const newPrefs = { ...preferences, rules };
      setPreferences(newPrefs);

      try {
        const supabase = getSupabaseClient();
        await supabase.rpc("update_inbox_preferences", {
          user_uuid: user.id,
          prefs: newPrefs,
        });
      } catch (err) {
        console.error("[Inbox] Failed to update rules:", err);
        // Revert on error
        setPreferences(preferences);
        setError("Failed to update inbox rules");
      }
    },
    [user, preferences]
  );

  return {
    preferences,
    isLoading,
    error,
    setEnabled,
    updateRules,
  };
}
