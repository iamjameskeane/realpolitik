/**
 * React hook for managing push notification subscriptions.
 *
 * Handles:
 * - Service worker registration
 * - Platform detection (iOS standalone, etc.)
 * - Permission management
 * - Subscription lifecycle
 * - Preference updates
 */

"use client";

import { useState, useEffect, useCallback } from "react";

// =============================================================================
// TYPES
// =============================================================================

export interface PushPreferences {
  enabled: boolean;
  minSeverity: number;
  categories: ("MILITARY" | "DIPLOMACY" | "ECONOMY" | "UNREST")[];
}

export interface PushState {
  isSupported: boolean;
  isStandalone: boolean; // PWA installed to home screen
  isIOS: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  preferences: PushPreferences;
}

export interface UsePushNotificationsReturn extends PushState {
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  updatePreferences: (prefs: Partial<PushPreferences>) => Promise<boolean>;
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
// DEFAULT STATE
// =============================================================================

const DEFAULT_PREFERENCES: PushPreferences = {
  enabled: false,
  minSeverity: 8,
  categories: ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"],
};

import { STORAGE_KEYS } from "@/lib/constants";

const STORAGE_KEY = STORAGE_KEYS.PUSH_PREFERENCES;

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
              return { ...prev, isSubscribed, preferences: { ...prev.preferences, enabled: isSubscribed } };
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

      // Load saved preferences
      let savedPrefs = DEFAULT_PREFERENCES;
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          savedPrefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
        }
      } catch {
        // Ignore localStorage errors
      }

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

      console.log("[Push] Setting final state:", { isSupported, permission, isSubscribed });

      setState({
        isSupported: true,
        isStandalone,
        isIOS,
        permission,
        isSubscribed,
        isLoading: false,
        error: null,
        preferences: { ...savedPrefs, enabled: isSubscribed },
      });
    };

    init();
  }, []);

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

  const subscribe = useCallback(async (): Promise<boolean> => {
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

      // Send subscription to server
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          preferences: {
            ...state.preferences,
            enabled: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save subscription");
      }

      // Save preferences locally
      const newPrefs = { ...state.preferences, enabled: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
        error: null,
        preferences: newPrefs,
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
  }, [state.isSupported, state.preferences, requestPermission, registerServiceWorker]);

  // ---------------------------------------------------------------------------
  // UNSUBSCRIBE
  // ---------------------------------------------------------------------------

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Remove from server
        await fetch("/api/push/unsubscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
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
    async (newPrefs: Partial<PushPreferences>): Promise<boolean> => {
      const updatedPrefs = { ...state.preferences, ...newPrefs };

      try {
        // If subscribed, update server
        if (state.isSubscribed) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();

          if (subscription) {
            await fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscription: subscription.toJSON(),
                preferences: updatedPrefs,
              }),
            });
          }
        }

        // Save locally
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPrefs));
        setState((prev) => ({ ...prev, preferences: updatedPrefs }));

        return true;
      } catch (error) {
        console.error("[Push] Update preferences failed:", error);
        return false;
      }
    },
    [state.preferences, state.isSubscribed]
  );

  // ---------------------------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------------------------

  return {
    ...state,
    subscribe,
    unsubscribe,
    updatePreferences,
    requestPermission,
  };
}
