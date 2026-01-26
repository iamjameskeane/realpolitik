/**
 * React hook for managing push notification subscriptions.
 *
 * Handles:
 * - Service worker registration
 * - Platform detection (iOS standalone, etc.)
 * - Permission management
 * - Subscription lifecycle
 * - Preference updates (both legacy and new rule-based)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  NotificationPreferences,
  NotificationRule,
  LegacyPreferences,
} from "@/types/notifications";
import { DEFAULT_PREFERENCES, migrateLegacyPreferences, DEFAULT_RULE } from "@/types/notifications";
import { getSupabaseClient } from "@/lib/supabase";

// =============================================================================
// TYPES
// =============================================================================

// Re-export legacy type for backwards compatibility
export type PushPreferences = LegacyPreferences;

// New unified preferences type
export type UnifiedPreferences = NotificationPreferences;

export interface PushState {
  isSupported: boolean;
  isStandalone: boolean; // PWA installed to home screen
  isIOS: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  preferences: NotificationPreferences;
  isFirstTimeSetup: boolean; // True if user hasn't configured preferences yet
}

export interface UsePushNotificationsReturn extends PushState {
  subscribe: (initialRules?: NotificationRule[]) => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<boolean>;
  updateRules: (rules: NotificationRule[]) => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Convert base64 VAPID key to Uint8Array for PushManager.subscribe()
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Detect if running as standalone PWA (added to home screen)
 */
function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;

  // iOS Safari
  if ((window.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;

  // Other browsers
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.matchMedia("(display-mode: fullscreen)").matches) return true;

  return false;
}

/**
 * Detect iOS device
 */
function isIOSDevice(): boolean {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

/**
 * Detect iOS version (returns major version number or 0 if not iOS)
 */
function getIOSVersion(): number {
  if (typeof window === "undefined") return 0;

  const match = window.navigator.userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Check if push notifications are supported
 */
function isPushSupported(): boolean {
  if (typeof window === "undefined") {
    console.log("[Push] SSR - window undefined");
    return false;
  }

  // Check for required APIs
  const hasServiceWorker = "serviceWorker" in navigator;
  const hasPushManager = "PushManager" in window;
  const hasNotification = "Notification" in window;

  console.log("[Push] Support check:", {
    hasServiceWorker,
    hasPushManager,
    hasNotification,
    isSecureContext: window.isSecureContext,
  });

  if (!hasServiceWorker || !hasPushManager || !hasNotification) {
    return false;
  }

  // iOS requires iOS 16.4+ AND standalone mode
  if (isIOSDevice()) {
    const version = getIOSVersion();
    if (version < 16) return false;
    // iOS also requires standalone mode, but we report this separately
  }

  return true;
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

import { STORAGE_KEYS } from "@/lib/constants";

const STORAGE_KEY = STORAGE_KEYS.PUSH_PREFERENCES;
const SETUP_COMPLETE_KEY = "realpolitik_notification_setup_complete";

// Helper to check if stored preferences are in new format
function isNewFormat(prefs: unknown): prefs is NotificationPreferences {
  return (
    typeof prefs === "object" &&
    prefs !== null &&
    "rules" in prefs &&
    Array.isArray((prefs as NotificationPreferences).rules)
  );
}

// Load and migrate preferences from storage
function loadStoredPreferences(): { prefs: NotificationPreferences; isNew: boolean } {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { prefs: DEFAULT_PREFERENCES, isNew: true };
    }

    const parsed = JSON.parse(stored);

    if (isNewFormat(parsed)) {
      return { prefs: parsed, isNew: false };
    }

    // Migrate legacy format
    const migrated = migrateLegacyPreferences(parsed);
    return { prefs: migrated, isNew: false };
  } catch {
    return { prefs: DEFAULT_PREFERENCES, isNew: true };
  }
}

function isSetupComplete(): boolean {
  try {
    return localStorage.getItem(SETUP_COMPLETE_KEY) === "true";
  } catch {
    return false;
  }
}

function markSetupComplete(): void {
  try {
    localStorage.setItem(SETUP_COMPLETE_KEY, "true");
  } catch {
    // Ignore
  }
}

// Custom event for subscription state changes (to sync multiple hook instances)
const SUBSCRIPTION_CHANGE_EVENT = "push-subscription-change";

// =============================================================================
// HOOK
// =============================================================================

export function usePushNotifications(): UsePushNotificationsReturn {
  const [state, setState] = useState<PushState>({
    isSupported: false,
    isStandalone: false,
    isIOS: false,
    permission: "unsupported",
    isSubscribed: false,
    isLoading: true,
    error: null,
    preferences: DEFAULT_PREFERENCES,
    isFirstTimeSetup: true,
  });

  // ---------------------------------------------------------------------------
  // SYNC SUBSCRIPTION STATE ACROSS INSTANCES
  // ---------------------------------------------------------------------------

  // Re-check subscription status when another instance changes it
  useEffect(() => {
    const handleSubscriptionChange = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          const isSubscribed = !!subscription;

          setState((prev) => {
            if (prev.isSubscribed !== isSubscribed) {
              console.log("[Push] Syncing subscription state:", isSubscribed);
              return {
                ...prev,
                isSubscribed,
                preferences: { ...prev.preferences, enabled: isSubscribed },
              };
            }
            return prev;
          });
        }
      } catch (e) {
        console.log("[Push] Error syncing subscription:", e);
      }
    };

    window.addEventListener(SUBSCRIPTION_CHANGE_EVENT, handleSubscriptionChange);
    return () => window.removeEventListener(SUBSCRIPTION_CHANGE_EVENT, handleSubscriptionChange);
  }, []);

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const init = async () => {
      const isSupported = isPushSupported();
      const isStandalone = isStandalonePWA();
      const isIOS = isIOSDevice();

      console.log("[Push] Init:", { isSupported, isStandalone, isIOS });

      // Load saved preferences (handles migration from legacy format)
      const { prefs: savedPrefs, isNew } = loadStoredPreferences();
      const setupComplete = isSetupComplete();
      const isFirstTimeSetup = isNew || !setupComplete;

      if (!isSupported) {
        setState({
          isSupported: false,
          isStandalone,
          isIOS,
          permission: "unsupported",
          isSubscribed: false,
          isLoading: false,
          error:
            isIOS && !isStandalone
              ? "Add to Home Screen to enable notifications"
              : "Push notifications not supported",
          preferences: savedPrefs,
          isFirstTimeSetup,
        });
        return;
      }

      // Check current permission
      const permission = Notification.permission;

      // Check if already subscribed (only if service worker is already registered)
      let isSubscribed = false;
      try {
        // First check if there's already a service worker registration
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length > 0) {
          // Only wait for ready if there's already a registration
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          isSubscribed = !!subscription;
        }
      } catch (e) {
        console.log("[Push] Error checking subscription:", e);
      }

      console.log("[Push] Setting final state:", {
        isSupported,
        permission,
        isSubscribed,
        isFirstTimeSetup,
      });

      setState({
        isSupported: true,
        isStandalone,
        isIOS,
        permission,
        isSubscribed,
        isLoading: false,
        error: null,
        preferences: { ...savedPrefs, enabled: isSubscribed },
        isFirstTimeSetup: isSubscribed ? false : isFirstTimeSetup,
      });
    };

    init();
  }, []);

  // ---------------------------------------------------------------------------
  // VERIFY SUBSCRIPTION WITH SERVER
  // ---------------------------------------------------------------------------
  // If we have a local subscription but it's not on the server, clean it up
  useEffect(() => {
    const verifySubscription = async () => {
      // Only run if we think we're subscribed and not loading
      if (!state.isSubscribed || state.isLoading) return;

      try {
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // Can't verify without auth
        if (!session) return;

        // Get local subscription endpoint
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (registrations.length === 0) return;

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        // Check if this subscription exists on the server
        const { data: devices, error } = await supabase.rpc("get_user_subscriptions", {
          user_uuid: session.user.id,
        });

        if (error) {
          console.error("[Push] Error verifying subscription:", error);
          return;
        }

        // Check if our endpoint is in the list
        const endpoint = subscription.endpoint;
        const isOnServer = devices?.some((d: { endpoint: string }) => d.endpoint === endpoint);

        if (!isOnServer) {
          console.log("[Push] Local subscription not on server, cleaning up...");
          // Unsubscribe locally to sync state
          await subscription.unsubscribe();
          setState((prev) => ({
            ...prev,
            isSubscribed: false,
            isFirstTimeSetup: true,
          }));
        }
      } catch (e) {
        console.error("[Push] Error verifying subscription:", e);
      }
    };

    verifySubscription();
  }, [state.isSubscribed, state.isLoading]);

  // ---------------------------------------------------------------------------
  // REGISTER SERVICE WORKER
  // ---------------------------------------------------------------------------

  const registerServiceWorker = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      // Wait for the service worker to be ready
      await navigator.serviceWorker.ready;

      // Send VAPID public key to service worker
      if (registration.active) {
        registration.active.postMessage({
          type: "SET_VAPID_KEY",
          key: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
      }

      return registration;
    } catch (error) {
      console.error("[Push] Service worker registration failed:", error);
      return null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // REQUEST PERMISSION
  // ---------------------------------------------------------------------------

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!state.isSupported) return "denied";

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));
      return permission;
    } catch (error) {
      console.error("[Push] Permission request failed:", error);
      return "denied";
    }
  }, [state.isSupported]);

  // ---------------------------------------------------------------------------
  // SUBSCRIBE
  // ---------------------------------------------------------------------------

  const subscribe = useCallback(
    async (initialRules?: NotificationRule[]): Promise<boolean> => {
      if (!state.isSupported) {
        setState((prev) => ({ ...prev, error: "Push not supported" }));
        return false;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Request permission if not granted
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await requestPermission();
        }

        if (permission !== "granted") {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "Notification permission denied",
          }));
          return false;
        }

        // Register service worker
        const registration = await registerServiceWorker();
        if (!registration) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "Service worker registration failed",
          }));
          return false;
        }

        // Subscribe to push
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "VAPID key not configured",
          }));
          return false;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
        });

        // Build new preferences with initial rules if provided
        const newPrefs: NotificationPreferences = {
          ...state.preferences,
          enabled: true,
          rules: initialRules ?? state.preferences.rules ?? [DEFAULT_RULE],
        };

        // Get auth session
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          // No session - unsubscribe locally to keep state in sync
          try {
            await subscription.unsubscribe();
          } catch (e) {
            console.error("[Push] Failed to unsubscribe after auth error:", e);
          }
          throw new Error("You must be signed in to enable notifications");
        }

        // Send subscription to server with auth token
        const response = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            preferences: newPrefs,
          }),
        });

        if (!response.ok) {
          // API failed - unsubscribe locally to keep state in sync
          try {
            await subscription.unsubscribe();
          } catch (e) {
            console.error("[Push] Failed to unsubscribe after API error:", e);
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to save subscription");
        }

        // Save preferences locally
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
        markSetupComplete();

        setState((prev) => ({
          ...prev,
          isSubscribed: true,
          isLoading: false,
          error: null,
          preferences: newPrefs,
          isFirstTimeSetup: false,
        }));

        // Notify other instances that subscription state changed
        window.dispatchEvent(new CustomEvent(SUBSCRIPTION_CHANGE_EVENT));

        return true;
      } catch (error: unknown) {
        console.error("[Push] Subscribe failed:", error);
        const errorMessage = error instanceof Error ? error.message : "Subscription failed";
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
        return false;
      }
    },
    [state.isSupported, state.preferences, requestPermission, registerServiceWorker]
  );

  // ---------------------------------------------------------------------------
  // UNSUBSCRIBE
  // ---------------------------------------------------------------------------

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Get auth session
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("You must be signed in to manage notifications");
        }

        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server with auth token
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      // Update local preferences
      const newPrefs = { ...state.preferences, enabled: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
        error: null,
        preferences: newPrefs,
      }));

      // Notify other instances that subscription state changed
      window.dispatchEvent(new CustomEvent(SUBSCRIPTION_CHANGE_EVENT));

      return true;
    } catch (error: unknown) {
      console.error("[Push] Unsubscribe failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unsubscribe failed";
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [state.preferences]);

  // ---------------------------------------------------------------------------
  // UPDATE PREFERENCES
  // ---------------------------------------------------------------------------

  const updatePreferences = useCallback(
    async (newPrefs: Partial<NotificationPreferences>): Promise<boolean> => {
      const updatedPrefs: NotificationPreferences = { ...state.preferences, ...newPrefs };

      // Clear any previous error
      setState((prev) => ({ ...prev, error: null }));

      try {
        // If subscribed, update server
        if (state.isSubscribed) {
          // Get auth session
          const supabase = getSupabaseClient();
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            throw new Error("You must be signed in to update notification preferences");
          }

          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            const response = await fetch("/api/push/subscribe", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                subscription: subscription.toJSON(),
                preferences: updatedPrefs,
              }),
            });

            if (!response.ok) {
              const data = await response.json().catch(() => ({}));
              const errorMsg = data.error || `Server error: ${response.status}`;
              setState((prev) => ({ ...prev, error: errorMsg }));
              console.error("[Push] Update preferences failed:", errorMsg);
              return false;
            }
          }
        }

        // Save locally
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPrefs));
        setState((prev) => ({ ...prev, preferences: updatedPrefs, error: null }));

        return true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to update preferences";
        console.error("[Push] Update preferences failed:", error);
        setState((prev) => ({ ...prev, error: errorMsg }));
        return false;
      }
    },
    [state.preferences, state.isSubscribed]
  );

  // ---------------------------------------------------------------------------
  // UPDATE RULES (convenience method)
  // ---------------------------------------------------------------------------

  const updateRules = useCallback(
    async (rules: NotificationRule[]): Promise<boolean> => {
      return updatePreferences({ rules });
    },
    [updatePreferences]
  );

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    ...state,
    subscribe,
    unsubscribe,
    updatePreferences,
    updateRules,
    requestPermission,
  };
}
