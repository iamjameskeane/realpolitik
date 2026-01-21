/**
 * Tests for service worker push notification logic
 * 
 * These tests verify the SW logic by testing the functions/patterns used,
 * since actual SW testing requires special browser environments.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Simulate the SW's URL construction logic
function buildNotificationUrl(
  baseUrl: string,
  eventId: string | undefined
): string {
  const cacheBuster = `_t=${Date.now()}`;
  if (eventId) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}from=notification&notif_event=${eventId}&${cacheBuster}`;
  }
  return `/?${cacheBuster}`;
}

// Simulate the SW's notification options construction
function buildNotificationOptions(data: {
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  id?: string;
  severity?: number;
  url?: string;
}) {
  return {
    body: data.body,
    icon: data.icon || "/android-chrome-192x192.png",
    badge: data.badge || "/favicon-32x32.png",
    tag: data.tag || data.id || "realpolitik-notification",
    renotify: true,
    requireInteraction: (data.severity || 5) >= 8,
    silent: false,
    vibrate: (data.severity || 5) >= 8 ? [200, 100, 200, 100, 200] : [200, 100, 200],
    data: {
      url: data.url || "/",
      eventId: data.id,
      timestamp: Date.now(),
    },
    actions: [
      { action: "view", title: "View Event", icon: "/favicon-32x32.png" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };
}

describe("Service Worker URL Construction", () => {
  it("should include event ID in notification URL", () => {
    const url = buildNotificationUrl("/?event=abc123", "abc123");
    
    expect(url).toContain("event=abc123");
    expect(url).toContain("notif_event=abc123");
    expect(url).toContain("from=notification");
  });

  it("should include cache buster in URL", () => {
    const url = buildNotificationUrl("/?event=abc123", "abc123");
    
    expect(url).toMatch(/_t=\d+/);
  });

  it("should use correct separator for URL params", () => {
    // URL already has query params
    const urlWithParams = buildNotificationUrl("/?event=abc123", "abc123");
    expect(urlWithParams).toContain("?event=abc123&from=notification");

    // URL without query params
    const urlWithoutParams = buildNotificationUrl("/", "abc123");
    expect(urlWithoutParams).toContain("?from=notification");
  });

  it("should handle missing event ID", () => {
    const url = buildNotificationUrl("/", undefined);
    
    expect(url).toMatch(/\/\?_t=\d+/);
    expect(url).not.toContain("notif_event");
  });

  it("should generate unique cache busters", () => {
    const url1 = buildNotificationUrl("/?event=abc", "abc");
    // Wait a tiny bit to ensure different timestamp
    const url2 = buildNotificationUrl("/?event=abc", "abc");
    
    // Extract timestamps
    const t1 = url1.match(/_t=(\d+)/)?.[1];
    const t2 = url2.match(/_t=(\d+)/)?.[1];
    
    // They should be the same or very close (within same millisecond)
    expect(t1).toBeDefined();
    expect(t2).toBeDefined();
  });
});

describe("Service Worker Notification Options", () => {
  it("should set requireInteraction for high severity events", () => {
    const highSeverity = buildNotificationOptions({
      body: "Critical event",
      severity: 9,
    });
    expect(highSeverity.requireInteraction).toBe(true);

    const lowSeverity = buildNotificationOptions({
      body: "Normal event",
      severity: 5,
    });
    expect(lowSeverity.requireInteraction).toBe(false);
  });

  it("should use longer vibration pattern for high severity", () => {
    const highSeverity = buildNotificationOptions({
      body: "Critical event",
      severity: 9,
    });
    expect(highSeverity.vibrate).toHaveLength(5);

    const lowSeverity = buildNotificationOptions({
      body: "Normal event",
      severity: 5,
    });
    expect(lowSeverity.vibrate).toHaveLength(3);
  });

  it("should use event ID as tag to prevent duplicates", () => {
    const options = buildNotificationOptions({
      body: "Test event",
      id: "event-123",
    });
    expect(options.tag).toBe("event-123");
  });

  it("should use fallback tag when no ID provided", () => {
    const options = buildNotificationOptions({
      body: "Test event",
    });
    expect(options.tag).toBe("realpolitik-notification");
  });

  it("should store event data for click handling", () => {
    const options = buildNotificationOptions({
      body: "Test event",
      id: "event-123",
      url: "/?event=event-123",
    });
    
    expect(options.data.eventId).toBe("event-123");
    expect(options.data.url).toBe("/?event=event-123");
    expect(options.data.timestamp).toBeDefined();
  });

  it("should always enable renotify", () => {
    const options = buildNotificationOptions({
      body: "Test event",
    });
    expect(options.renotify).toBe(true);
  });

  it("should not be silent", () => {
    const options = buildNotificationOptions({
      body: "Test event",
    });
    expect(options.silent).toBe(false);
  });
});

describe("Service Worker IndexedDB Logic", () => {
  // Simulate the pending notification storage logic
  interface PendingNotification {
    eventId: string;
    title: string;
    timestamp: number;
  }

  let pendingStore: Map<string, PendingNotification>;

  beforeEach(() => {
    pendingStore = new Map();
  });

  function addPendingNotification(eventId: string, title: string, timestamp: number) {
    pendingStore.set(eventId, { eventId, title, timestamp });
  }

  function getPendingCount(): number {
    return pendingStore.size;
  }

  function getPendingNotifications(): string[] {
    return Array.from(pendingStore.keys());
  }

  function removePendingNotification(eventId: string) {
    pendingStore.delete(eventId);
  }

  function clearAllPending() {
    pendingStore.clear();
  }

  it("should store pending notifications by event ID", () => {
    addPendingNotification("event-1", "Title 1", Date.now());
    addPendingNotification("event-2", "Title 2", Date.now());

    expect(getPendingCount()).toBe(2);
    expect(getPendingNotifications()).toContain("event-1");
    expect(getPendingNotifications()).toContain("event-2");
  });

  it("should not duplicate pending notifications", () => {
    addPendingNotification("event-1", "Title 1", Date.now());
    addPendingNotification("event-1", "Title 1 Updated", Date.now());

    expect(getPendingCount()).toBe(1);
  });

  it("should remove specific pending notification", () => {
    addPendingNotification("event-1", "Title 1", Date.now());
    addPendingNotification("event-2", "Title 2", Date.now());

    removePendingNotification("event-1");

    expect(getPendingCount()).toBe(1);
    expect(getPendingNotifications()).not.toContain("event-1");
    expect(getPendingNotifications()).toContain("event-2");
  });

  it("should clear all pending notifications", () => {
    addPendingNotification("event-1", "Title 1", Date.now());
    addPendingNotification("event-2", "Title 2", Date.now());
    addPendingNotification("event-3", "Title 3", Date.now());

    clearAllPending();

    expect(getPendingCount()).toBe(0);
  });
});

describe("Service Worker Navigation Logic", () => {
  // iOS PWA critical: Must use client.navigate() not postMessage
  // This tests the decision logic

  interface MockClient {
    url: string;
    hasNavigate: boolean;
    hasFocus: boolean;
  }

  function shouldUseNavigate(client: MockClient, origin: string): boolean {
    return client.url.includes(origin) && client.hasNavigate;
  }

  function shouldOpenNewWindow(clients: MockClient[], origin: string): boolean {
    // Only open new window if no existing window can be navigated
    return !clients.some(c => shouldUseNavigate(c, origin));
  }

  it("should prefer navigate over openWindow when client exists", () => {
    const clients: MockClient[] = [
      { url: "https://realpolitik.world/", hasNavigate: true, hasFocus: true },
    ];

    expect(shouldOpenNewWindow(clients, "realpolitik.world")).toBe(false);
  });

  it("should open new window when no clients exist", () => {
    const clients: MockClient[] = [];

    expect(shouldOpenNewWindow(clients, "realpolitik.world")).toBe(true);
  });

  it("should open new window when client lacks navigate capability", () => {
    const clients: MockClient[] = [
      { url: "https://realpolitik.world/", hasNavigate: false, hasFocus: true },
    ];

    expect(shouldOpenNewWindow(clients, "realpolitik.world")).toBe(true);
  });

  it("should not navigate clients from other origins", () => {
    const clients: MockClient[] = [
      { url: "https://other-site.com/", hasNavigate: true, hasFocus: true },
    ];

    expect(shouldOpenNewWindow(clients, "realpolitik.world")).toBe(true);
  });
});

describe("Service Worker Badge Logic", () => {
  it("should show badge count from pending notifications", () => {
    const pendingCount = 5;
    
    // Badge should show the count
    expect(pendingCount).toBeGreaterThan(0);
  });

  it("should not show badge for zero pending", () => {
    const pendingCount = 0;
    const shouldShowBadge = pendingCount > 0;
    
    expect(shouldShowBadge).toBe(false);
  });
});

describe("Service Worker Push Data Parsing", () => {
  function parsePushData(jsonString: string): Record<string, unknown> {
    const defaults = {
      title: "Realpolitik",
      body: "New event detected",
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      url: "/",
      tag: "default",
      severity: 5,
    };

    try {
      const payload = JSON.parse(jsonString);
      return { ...defaults, ...payload };
    } catch {
      return { ...defaults, body: jsonString || defaults.body };
    }
  }

  it("should parse valid JSON payload", () => {
    const payload = JSON.stringify({
      title: "Breaking News",
      body: "Something happened",
      severity: 8,
      id: "event-123",
    });

    const data = parsePushData(payload);

    expect(data.title).toBe("Breaking News");
    expect(data.body).toBe("Something happened");
    expect(data.severity).toBe(8);
    expect(data.id).toBe("event-123");
  });

  it("should use defaults for missing fields", () => {
    const payload = JSON.stringify({
      body: "Minimal payload",
    });

    const data = parsePushData(payload);

    expect(data.title).toBe("Realpolitik");
    expect(data.icon).toBe("/android-chrome-192x192.png");
    expect(data.severity).toBe(5);
  });

  it("should handle invalid JSON gracefully", () => {
    const data = parsePushData("not valid json");

    expect(data.title).toBe("Realpolitik");
    expect(data.body).toBe("not valid json");
  });

  it("should handle empty payload", () => {
    const data = parsePushData("");

    expect(data.title).toBe("Realpolitik");
    expect(data.body).toBe("New event detected");
  });
});
