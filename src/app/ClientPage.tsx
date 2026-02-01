"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Dashboard } from "@/components/Dashboard";
import { MobileLayout } from "@/components/mobile";
import { InstallPrompt } from "@/components/InstallPrompt";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { useEvents } from "@/hooks/useEvents";
import { STORAGE_KEYS } from "@/lib/constants";
import { GeoEvent } from "@/types/events";
import { EntityFromDB, fetchEntityBySlug } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

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

  // Deep linking - get event ID and entity slug from URL
  const initialEventId = searchParams.get("event");
  const initialEntitySlug = searchParams.get("entity");

  // Entity deep linking state
  const [initialEntity, setInitialEntity] = useState<EntityFromDB | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);

  // Handle event deep link - fetch event if not in current data
  useEffect(() => {
    if (!initialEventId || isLoading) return;

    // Check if event is already loaded
    const eventExists = events.some((e) => e.id === initialEventId);
    if (eventExists) return;

    // Fetch the event from Supabase
    fetchEventById(initialEventId).catch((err) =>
      console.error("Failed to load deep-linked event:", err)
    );
  }, [initialEventId, events, isLoading, fetchEventById]);

  // Handle entity deep link - fetch entity by slug
  useEffect(() => {
    if (!initialEntitySlug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInitialEntity(null);
      return;
    }

    setEntityLoading(true);
    fetchEntityBySlug(initialEntitySlug)
      .then((entity) => {
        setInitialEntity(entity);
        if (!entity) {
          console.warn("Entity not found:", initialEntitySlug);
        }
      })
      .catch((err) => {
        console.error("Failed to load deep-linked entity:", err);
        setInitialEntity(null);
      })
      .finally(() => setEntityLoading(false));
  }, [initialEntitySlug]);

  // Callback to clear entity from URL when modal closes
  const clearEntityParam = useCallback(() => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("entity");
    window.history.replaceState({}, "", newUrl.toString());
    setInitialEntity(null);
  }, []);

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
        initialEntity={initialEntity}
        initialEntityLoading={entityLoading}
        onEntityModalClose={clearEntityParam}
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
      initialEntity={initialEntity}
      initialEntityLoading={entityLoading}
      onEntityModalClose={clearEntityParam}
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
/**
 * Upgrade Toast - Shows after Stripe checkout
 */
function UpgradeToastUI({
  status,
  onClose,
}: {
  status: "success" | "canceled";
  onClose: () => void;
}) {
  const isSuccess = status === "success";

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-20 left-1/2 z-[100] -translate-x-1/2 md:bottom-8"
    >
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${
          isSuccess
            ? "border-amber-500/30 bg-amber-500/20 text-amber-100"
            : "border-slate-600 bg-slate-800/90 text-slate-200"
        }`}
      >
        {isSuccess ? (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/30">
              <svg
                className="h-5 w-5 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Welcome to Pro!</p>
              <p className="text-sm text-amber-200/70">All features unlocked</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700">
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p>Upgrade canceled</p>
          </>
        )}
        <button
          onClick={onClose}
          className="ml-2 rounded-full p-1 text-current/50 hover:bg-white/10 hover:text-current"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

/**
 * UpgradeToast - Handles URL param detection and shows toast
 * Must be inside Suspense because it uses useSearchParams
 */
function UpgradeToast() {
  const [toastStatus, setToastStatus] = useState<"success" | "canceled" | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    const upgradeParam = searchParams.get("upgrade");
    if (upgradeParam === "success" || upgradeParam === "canceled") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToastStatus(upgradeParam);
      if (upgradeParam === "success") {
        refreshProfile();
      }
      // Clear the URL param
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("upgrade");
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
      // Auto-dismiss after 5 seconds
      setTimeout(() => setToastStatus(null), 5000);
    }
  }, [searchParams, router, refreshProfile]);

  return (
    <AnimatePresence>
      {toastStatus && <UpgradeToastUI status={toastStatus} onClose={() => setToastStatus(null)} />}
    </AnimatePresence>
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
      <UpgradeToast />
    </Suspense>
  );
}
