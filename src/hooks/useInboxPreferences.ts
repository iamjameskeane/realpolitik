/**
 * Hook for managing user inbox preferences (separate from push notifications)
 *
 * Inbox = synced notification list across all devices
 * Push = browser push notifications on specific devices
 */

import { useState, useEffect, useCallback, useRef } from "react";
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

const CACHE_KEY = "realpolitik_inbox_prefs_cache";

// Load from localStorage cache
function getCachedPreferences(): InboxPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as InboxPreferences;
    }
  } catch {
    // Ignore
  }
  return null;
}

// Save to localStorage cache
function setCachedPreferences(prefs: InboxPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore
  }
}

export function useInboxPreferences() {
  const { user } = useAuth();
  // Initialize from cache if available, so we don't show loading state
  const cached = getCachedPreferences();
  const [preferences, setPreferences] = useState<InboxPreferences>(cached || DEFAULT_PREFERENCES);
  // Only show loading if we don't have cached data
  const [isLoading, setIsLoading] = useState(!cached);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // Load preferences from Supabase
  useEffect(() => {
    isMountedRef.current = true;

    if (!user) {
      setPreferences(DEFAULT_PREFERENCES);
      setIsLoading(false);
      return;
    }

    const loadPreferences = async () => {
      // Only show loading if we don't have cached data
      if (!getCachedPreferences()) {
        setIsLoading(true);
      }

      try {
        const supabase = getSupabaseClient();
        const { data, error: fetchError } = await supabase.rpc("get_inbox_preferences", {
          user_uuid: user.id,
        });

        if (!isMountedRef.current) return;

        if (fetchError) throw fetchError;

        if (data) {
          const prefs = data as InboxPreferences;
          setPreferences(prefs);
          setCachedPreferences(prefs);
        }
      } catch (err) {
        console.error("[Inbox] Failed to load preferences:", err);
        if (isMountedRef.current) {
          setError("Failed to load inbox preferences");
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    loadPreferences();

    return () => {
      isMountedRef.current = false;
    };
  }, [user]);

  // Toggle inbox enabled/disabled
  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!user) return;

      const oldPrefs = preferences;
      const newPrefs = { ...preferences, enabled };
      setPreferences(newPrefs);
      setCachedPreferences(newPrefs); // Update cache immediately
      setIsSaving(true);

      try {
        const supabase = getSupabaseClient();
        await supabase.rpc("update_inbox_preferences", {
          user_uuid: user.id,
          prefs: newPrefs,
        });
      } catch (err) {
        console.error("[Inbox] Failed to update enabled:", err);
        // Revert on error
        setPreferences(oldPrefs);
        setCachedPreferences(oldPrefs);
        setError("Failed to update inbox settings");
      } finally {
        setIsSaving(false);
      }
    },
    [user, preferences]
  );

  // Update rules
  const updateRules = useCallback(
    async (rules: NotificationRule[]) => {
      if (!user) return;

      const oldPrefs = preferences;
      const newPrefs = { ...preferences, rules };
      setPreferences(newPrefs);
      setCachedPreferences(newPrefs); // Update cache immediately
      setIsSaving(true);

      try {
        const supabase = getSupabaseClient();
        await supabase.rpc("update_inbox_preferences", {
          user_uuid: user.id,
          prefs: newPrefs,
        });
      } catch (err) {
        console.error("[Inbox] Failed to update rules:", err);
        // Revert on error
        setPreferences(oldPrefs);
        setCachedPreferences(oldPrefs);
        setError("Failed to update inbox rules");
      } finally {
        setIsSaving(false);
      }
    },
    [user, preferences]
  );

  return {
    preferences,
    isLoading,
    isSaving,
    error,
    setEnabled,
    updateRules,
  };
}
