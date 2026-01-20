"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { GeoEvent } from "@/types/events";

const STORAGE_KEY = "realpolitik_notification_inbox";

// IndexedDB constants (must match service worker)
const DB_NAME = "realpolitik-notifications";
const DB_VERSION = 1;
const STORE_NAME = "pending";

// =============================================================================
// LOCALSTORAGE HELPERS (main inbox storage)
// =============================================================================

function getStoredInbox(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveInbox(eventIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(eventIds));
  } catch {
    // Storage full or unavailable
  }
}

// =============================================================================
// INDEXEDDB HELPERS (pending notifications from service worker)
// =============================================================================

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "eventId" });
      }
    };
  });
}

async function getPendingNotifications(): Promise<string[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    const items = await new Promise<{ eventId: string }[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return items.map((item) => item.eventId);
  } catch (e) {
    console.log("[Inbox] Failed to read pending notifications:", e);
    return [];
  }
}

async function removePendingNotification(eventId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(eventId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.log("[Inbox] Failed to remove pending notification:", e);
  }
}

async function clearAllPending(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.log("[Inbox] Failed to clear pending notifications:", e);
  }
}

// =============================================================================
// BADGE HELPERS
// =============================================================================

function clearAppBadge() {
  if (typeof navigator !== "undefined" && "clearAppBadge" in navigator) {
    (navigator as Navigator & { clearAppBadge: () => Promise<void> })
      .clearAppBadge()
      .catch(() => {});
  }
}

function setAppBadge(count: number) {
  if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
    const nav = navigator as Navigator & { setAppBadge: (count?: number) => Promise<void> };
    if (count > 0) {
      nav.setAppBadge(count).catch(() => {});
    } else {
      clearAppBadge();
    }
  }
}

// =============================================================================
// URL PARAM HELPERS (for notification click handling)
// =============================================================================

function checkUrlForNotification(): string | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const fromNotification = url.searchParams.get("from") === "notification";
  const notifEventId = url.searchParams.get("notif_event");

  if (fromNotification && notifEventId) {
    // Clean up URL params (don't leave them visible)
    url.searchParams.delete("from");
    url.searchParams.delete("notif_event");
    window.history.replaceState({}, "", url.toString());
    return notifEventId;
  }

  return null;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Hook to manage the notification inbox - events that arrived via push notifications.
 *
 * iOS COMPATIBILITY (Hybrid Approach):
 * - Service Worker writes to IndexedDB when push arrives
 * - App syncs from IndexedDB on visibility change
 * - URL params used when notification is clicked (removes from IndexedDB to prevent duplicates)
 * - postMessage still works for Android/Desktop real-time updates
 */
export function useNotificationInbox(allEvents: GeoEvent[]) {
  const [inboxEventIds, setInboxEventIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Sync pending notifications from IndexedDB into inbox
  const syncFromIndexedDB = useCallback(async () => {
    const pendingIds = await getPendingNotifications();
    if (pendingIds.length === 0) return;

    setInboxEventIds((prev) => {
      const newIds = pendingIds.filter((id) => !prev.includes(id));
      if (newIds.length === 0) return prev;

      const updated = [...newIds, ...prev];
      saveInbox(updated);
      setAppBadge(updated.length);
      return updated;
    });

    // Clear pending after syncing (they're now in localStorage inbox)
    await clearAllPending();
  }, []);

  // Load from localStorage on mount + check URL + sync IndexedDB
  useEffect(() => {
    const init = async () => {
      let stored = getStoredInbox();

      // iOS WORKAROUND: Check URL for notification event ID (from notification click)
      const notifEventId = checkUrlForNotification();
      if (notifEventId) {
        // Remove from IndexedDB pending
        await removePendingNotification(notifEventId);

        // IMPORTANT: User clicked this notification, so they've "seen" it
        // Remove it from inbox (not add it)
        if (stored.includes(notifEventId)) {
          stored = stored.filter((id) => id !== notifEventId);
          saveInbox(stored);
        }
      }

      setInboxEventIds(stored);
      setAppBadge(stored.length);
      setIsLoaded(true);

      // Sync any pending notifications from IndexedDB
      await syncFromIndexedDB();
    };

    init();
  }, [syncFromIndexedDB]);

  // iOS WORKAROUND: Sync from IndexedDB on visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        // Check URL again (user may have clicked notification while app was suspended)
        const notifEventId = checkUrlForNotification();
        if (notifEventId) {
          await removePendingNotification(notifEventId);
          // User clicked this notification - REMOVE from inbox (they've seen it)
          setInboxEventIds((prev) => {
            if (!prev.includes(notifEventId)) return prev;
            const updated = prev.filter((id) => id !== notifEventId);
            saveInbox(updated);
            setAppBadge(updated.length);
            return updated;
          });
        }

        // Sync any other pending notifications from IndexedDB
        await syncFromIndexedDB();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [syncFromIndexedDB]);

  // Listen for messages from service worker (works on Android/Desktop)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Notification arrived - add to inbox
      if (event.data?.type === "NOTIFICATION_RECEIVED") {
        const eventId = event.data.eventId;
        if (eventId) {
          // Remove from IndexedDB pending (we got the message directly)
          removePendingNotification(eventId);

          setInboxEventIds((prev) => {
            if (prev.includes(eventId)) return prev;
            const updated = [eventId, ...prev];
            saveInbox(updated);
            setAppBadge(updated.length);
            return updated;
          });
        }
      }

      // Notification clicked - navigate to the event (Android/Desktop)
      if (event.data?.type === "NOTIFICATION_CLICK") {
        const url = event.data.url;
        if (url && typeof window !== "undefined") {
          window.location.href = url;
        }
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, []);

  // Get actual event objects for inbox (filter to events that still exist)
  const inboxEvents = useMemo(() => {
    const eventMap = new Map(allEvents.map((e) => [e.id, e]));
    return inboxEventIds
      .map((id) => eventMap.get(id))
      .filter((e): e is GeoEvent => e !== undefined);
  }, [allEvents, inboxEventIds]);

  // Add event to inbox
  const addToInbox = useCallback((eventId: string) => {
    removePendingNotification(eventId); // Remove from pending if exists
    setInboxEventIds((prev) => {
      if (prev.includes(eventId)) return prev;
      const updated = [eventId, ...prev];
      saveInbox(updated);
      setAppBadge(updated.length);
      return updated;
    });
  }, []);

  // Remove single event from inbox
  const removeFromInbox = useCallback((eventId: string) => {
    setInboxEventIds((prev) => {
      const updated = prev.filter((id) => id !== eventId);
      saveInbox(updated);
      setAppBadge(updated.length);
      return updated;
    });
  }, []);

  // Clear entire inbox
  const clearInbox = useCallback(() => {
    setInboxEventIds([]);
    saveInbox([]);
    clearAppBadge();
    clearAllPending(); // Also clear any pending in IndexedDB
  }, []);

  // Check if event is in inbox
  const isInInbox = useCallback(
    (eventId: string) => inboxEventIds.includes(eventId),
    [inboxEventIds]
  );

  return {
    inboxEvents,
    inboxCount: inboxEvents.length,
    inboxEventIds,
    addToInbox,
    removeFromInbox,
    clearInbox,
    isInInbox,
    isLoaded,
  };
}
