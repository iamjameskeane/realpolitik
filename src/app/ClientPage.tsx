"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { MobileLayout } from "@/components/mobile";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useEvents } from "@/hooks/useEvents";
import { STORAGE_KEYS } from "@/lib/constants";
import { GeoEvent } from "@/types/events";

interface ClientPageProps {
  initialEvents: GeoEvent[];
}

/**
 * HomeContent - Main application content
 *
 * Uses SWR via useEvents for:
 * - Automatic polling every 60s
 * - Stale-while-revalidate pattern
 * - Revalidation on window focus
 * - Deep link support for events outside current time window
 */
function HomeContent({ initialEvents }: ClientPageProps) {
  const {
    events,
    isLoading,
    isRefreshing,
    isExpanding,
    refresh,
    dataUpdatedAt,
    fetchEventById,
    expandToHours,
    maxHoursLoaded,
  } = useEvents({ initialEvents });

  const searchParams = useSearchParams();
  const isMobileScreen = useIsMobile();
  const [deepLinkLoading, setDeepLinkLoading] = useState(false);

  // Allow forcing mobile mode via ?mobile=1 URL parameter for testing
  const forceMobile = searchParams.get("mobile") === "1";
  const isMobile = isMobileScreen || forceMobile;

  // Debug: Reset localStorage with ?reset=1 URL parameter
  useEffect(() => {
    if (searchParams.get("reset") === "1") {
      localStorage.removeItem(STORAGE_KEYS.LAST_VISIT);
      localStorage.removeItem(STORAGE_KEYS.READ_IDS);
      window.location.href = "/";
    }
  }, [searchParams]);

  // Deep linking - get event ID from URL
  const initialEventId = searchParams.get("event");

  // Handle deep link - fetch event if not in current data
  useEffect(() => {
    if (!initialEventId || isLoading) return;

    // Check if event is already loaded
    const eventExists = events.some((e) => e.id === initialEventId);
    if (eventExists) return;

    // Fetch the event from Supabase
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDeepLinkLoading(true);
    fetchEventById(initialEventId)
      .catch((err) => console.error("Failed to load deep-linked event:", err))
      .finally(() => setDeepLinkLoading(false));
  }, [initialEventId, events, isLoading, fetchEventById]);

  // Listen for notification clicks from service worker (when app is already open)
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "NOTIFICATION_CLICK") {
        const { url, eventId } = event.data;
        // Navigate to the event URL
        if (url && url !== window.location.pathname + window.location.search) {
          window.location.href = url;
        } else if (eventId) {
          // If same page, just update the URL param to trigger event selection
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("event", eventId);
          window.history.pushState({}, "", newUrl.toString());
          // Dispatch a custom event to notify components
          window.dispatchEvent(
            new CustomEvent("notification-event-select", { detail: { eventId } })
          );

          // Fetch event if not already loaded
          fetchEventById(eventId).catch(console.error);
        }
      }
    };

    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [fetchEventById]);

  // Convert timestamp to Date (memoized to avoid creating new Date on every render)
  const lastUpdated = useMemo(
    () => (dataUpdatedAt ? new Date(dataUpdatedAt) : null),
    [dataUpdatedAt]
  );

  // With SSR, we have initial events so we skip the loading state
  // Only show loading if we somehow have no events (shouldn't happen with SSR)
  if (isLoading && events.length === 0) {
    return <LoadingFallback />;
  }

  // Render mobile or desktop layout based on screen size
  if (isMobile) {
    return (
      <MobileLayout
        events={events}
        lastUpdated={lastUpdated}
        isRefreshing={isRefreshing || isExpanding}
        initialEventId={initialEventId}
        onExpandTimeRange={expandToHours}
        maxHoursLoaded={maxHoursLoaded}
      />
    );
  }

  // Wrap refresh for Dashboard type compatibility
  const handleRefresh = async () => {
    await refresh();
  };

  return (
    <Dashboard
      events={events}
      onRefresh={handleRefresh}
      lastUpdated={lastUpdated}
      isRefreshing={isRefreshing || isExpanding}
      initialEventId={initialEventId}
      onExpandTimeRange={expandToHours}
      maxHoursLoaded={maxHoursLoaded}
      fetchEventById={fetchEventById}
    />
  );
}

/**
 * Loading fallback for initial load and Suspense boundary
 */
function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-foreground/20 border-t-accent" />
        <p className="font-mono text-sm text-foreground/50">Loading intelligence...</p>
      </div>
    </div>
  );
}

/**
 * ClientPage - Client-side page wrapper
 *
 * Receives SSR'd events and hydrates with SWR for real-time updates.
 * Wrapped in Suspense for useSearchParams compatibility.
 */
export function ClientPage({ initialEvents }: ClientPageProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent initialEvents={initialEvents} />
      <InstallPrompt />
      <NotificationPrompt />
    </Suspense>
  );
}
