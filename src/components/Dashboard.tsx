"use client";

import { useState, useMemo, useRef, useCallback, useEffect, forwardRef } from "react";
import { WorldMap, WorldMapHandle } from "./WorldMap";
import { EventsSidebar } from "./EventsSidebar";
import { SplashScreen } from "./SplashScreen";
import { ErrorBoundary } from "./ErrorBoundary";
import { MapFallback } from "./map/MapFallback";
import { BriefingModal } from "./BriefingModal";
import { AnimatePresence } from "framer-motion";
import { AboutModal } from "./AboutModal";
import { SettingsModal } from "./SettingsModal";
import { useAuth } from "@/contexts/AuthContext";
import { GeoEvent, CATEGORY_COLORS, CATEGORY_DESCRIPTIONS, EventCategory } from "@/types/events";
import { BatchReactionsProvider, useBatchReactions } from "@/hooks/useBatchReactions";
import { useEventStates } from "@/hooks/useEventStates";
import { useNotificationInbox } from "@/hooks/useNotificationInbox";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useInboxPreferences } from "@/hooks/useInboxPreferences";
import { TIME_DISPLAY_UPDATE_MS, TIME_RANGES, MIN_TIME_RANGE_OPTIONS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/formatters";
import { useTouringMode } from "@/hooks/useTouringMode";

// Wrapper component that passes reactions and event states to WorldMap
const WorldMapWithReactionsAndStates = forwardRef<
  WorldMapHandle,
  React.ComponentProps<typeof WorldMap> & { eventStateMap?: Map<string, string> }
>(function WorldMapWithReactionsAndStates({ eventStateMap, ...props }, ref) {
  const { reactions } = useBatchReactions();
  return <WorldMap ref={ref} {...props} reactions={reactions} eventStateMap={eventStateMap} />;
});

interface DashboardProps {
  events: GeoEvent[];
  onRefresh?: () => Promise<void>;
  lastUpdated?: Date | null;
  isRefreshing?: boolean;
  initialEventId?: string | null;
  /** Callback to expand time range - fetches more data from server */
  onExpandTimeRange?: (hours: number) => Promise<void>;
  /** Maximum hours currently loaded from server */
  maxHoursLoaded?: number;
  /** Fetch a single event by ID (for entity modal navigation) */
  fetchEventById?: (id: string) => Promise<GeoEvent | null>;
}

const CATEGORIES: EventCategory[] = ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"];
const ALL_CATEGORIES = new Set<EventCategory>(CATEGORIES);

export function Dashboard({
  events,
  lastUpdated,
  isRefreshing,
  initialEventId,
  onExpandTimeRange,
  maxHoursLoaded = 24,
  fetchEventById,
}: DashboardProps) {
  const [showSplash, setShowSplash] = useState(false); // Disabled - set to true to re-enable
  const [timeRangeIndex, setTimeRangeIndex] = useState(4); // Default to 24H

  // Handle time range change - expand data fetch if needed
  const handleTimeRangeChange = useCallback(
    (newIndex: number) => {
      setTimeRangeIndex(newIndex);

      // Check if we need to fetch more data
      const selectedRange = TIME_RANGES[newIndex];
      if (selectedRange && onExpandTimeRange && selectedRange.hours > maxHoursLoaded) {
        onExpandTimeRange(selectedRange.hours);
      }
    },
    [onExpandTimeRange, maxHoursLoaded]
  );
  const [isSliderActive, setIsSliderActive] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<EventCategory | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(ALL_CATEGORIES);
  const [minSeverity, setMinSeverity] = useState(1); // Filter events >= this severity
  const [showSeverityPopover, setShowSeverityPopover] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [displayedTime, setDisplayedTime] = useState<string>("");
  const [is2DMode, setIs2DMode] = useState(false);
  const [briefingEvent, setBriefingEvent] = useState<GeoEvent | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const mapRef = useRef<WorldMapHandle>(null);
  const initialEventHandled = useRef(false);
  // Track when a map event was clicked to prevent sidebar toggle interference
  const lastMapClickRef = useRef<number>(0);

  // Calculate which time ranges have data (dynamic slider) - needed before useEventStates
  const availableTimeRanges = useMemo(() => {
    if (events.length === 0) return TIME_RANGES.slice(0, MIN_TIME_RANGE_OPTIONS);

    const now = new Date();
    const oldestEvent = events.reduce((oldest, e) => {
      const ts = new Date(e.timestamp);
      return ts < oldest ? ts : oldest;
    }, new Date());

    const maxHours = (now.getTime() - oldestEvent.getTime()) / (1000 * 60 * 60);

    // Find the first range that COVERS all data (so selecting it shows all events)
    let coveringIndex = 0;
    for (let i = 0; i < TIME_RANGES.length; i++) {
      if (TIME_RANGES[i].hours >= maxHours) {
        coveringIndex = i;
        break;
      }
      coveringIndex = i; // If no range covers all data, use the largest
    }

    // Include one more option beyond the covering range for flexibility
    const lastIndex = Math.min(coveringIndex + 1, TIME_RANGES.length - 1);

    // Always show at least MIN_TIME_RANGE_OPTIONS options
    return TIME_RANGES.slice(0, Math.max(MIN_TIME_RANGE_OPTIONS, lastIndex + 1));
  }, [events]);

  // Clamp timeRangeIndex to available options (derived, not effect-based)
  const clampedTimeRangeIndex = Math.min(timeRangeIndex, availableTimeRanges.length - 1);

  // Filter by time range first - inbox respects the time slider
  const timeFilteredEvents = useMemo(() => {
    const now = new Date();
    const range = availableTimeRanges[clampedTimeRangeIndex];
    if (!range) return events;

    const cutoff = new Date(now.getTime() - range.hours * 60 * 60 * 1000);
    return events.filter((event) => new Date(event.timestamp) >= cutoff);
  }, [events, clampedTimeRangeIndex, availableTimeRanges]);

  // Event states for "What's New" + "Unread" tracking - uses time-filtered events
  const {
    incomingEvents,
    eventStateMap,
    markAsRead,
    isLoaded: eventStatesLoaded,
  } = useEventStates(timeFilteredEvents);

  // Auth context for gating features
  const { user } = useAuth();

  // Notification inbox - tracks events that arrived via push notifications
  // Uses ALL events (not time-filtered) so notifications don't disappear based on time range
  // Only enabled if user is signed in
  const {
    inboxEvents,
    inboxCount,
    removeFromInbox,
    clearInbox: clearNotificationInbox,
    isLoaded: inboxLoaded,
  } = useNotificationInbox(user ? events : []);

  // Push notification subscription status (for showing push-specific messages)
  const { isSubscribed: pushSubscribed } = usePushNotifications();

  // Inbox preferences - determines if inbox is enabled
  const { preferences: inboxPrefs, isLoading: inboxPrefsLoading } = useInboxPreferences();

  // Update URL with event ID (for sharing)
  const updateUrlWithEvent = useCallback((eventId: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (eventId) {
      url.searchParams.set("event", eventId);
    } else {
      url.searchParams.delete("event");
    }
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Update displayed relative time periodically
  useEffect(() => {
    if (!lastUpdated) return;

    const updateTime = () => {
      setDisplayedTime(formatRelativeTime(lastUpdated));
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, TIME_DISPLAY_UPDATE_MS);

    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Note: Polling is now handled by SWR in useEvents hook
  // The onRefresh prop is still available for manual refresh (e.g., pull-to-refresh)

  // Handle initial event from URL (deep linking)
  // Only runs on initial page load, not when URL changes via replaceState
  useEffect(() => {
    // Skip if already handled, no initial event, or no events loaded
    if (initialEventHandled.current || !initialEventId || events.length === 0) return;

    const event = events.find((e) => e.id === initialEventId);
    if (event) {
      initialEventHandled.current = true;

      // Use RAF to batch state updates and avoid cascading renders
      requestAnimationFrame(() => {
        setSelectedEventId(event.id);
        // Sidebar stays closed - user must open it explicitly
        // Skip splash screen for deep links
        setShowSplash(false);
      });

      // Fly to event after a short delay (let map initialize)
      setTimeout(() => {
        mapRef.current?.flyToEvent(event);
      }, 1000);
    }
  }, [initialEventId, events]);

  // Clear notification inbox and close dropdown
  const clearInbox = useCallback(() => {
    clearNotificationInbox();
    setInboxOpen(false);
  }, [clearNotificationInbox]);

  // Filter by active categories (for globe and sidebar)
  // Also include the selected event even if it's outside the time/category filters
  // This ensures notification/inbox clicks always show the event on the map
  const filteredEvents = useMemo(() => {
    let filtered = timeFilteredEvents.filter((e) => activeCategories.has(e.category));

    // Filter by minimum severity
    if (minSeverity > 1) {
      filtered = filtered.filter((e) => e.severity >= minSeverity);
    }

    // If there's a selected event that's not in the filtered list, add it
    // This handles: notification deep links, inbox clicks, any selection of older events
    // Note: We bypass category/severity filter for selected events - if user clicked it, they want to see it
    if (selectedEventId && !filtered.some((e) => e.id === selectedEventId)) {
      const selectedEvent = events.find((e) => e.id === selectedEventId);
      if (selectedEvent) {
        return [selectedEvent, ...filtered];
      }
    }

    return filtered;
  }, [timeFilteredEvents, activeCategories, minSeverity, selectedEventId, events]);

  const categoryCounts = useMemo(() => {
    return {
      MILITARY: timeFilteredEvents.filter((e) => e.category === "MILITARY").length,
      DIPLOMACY: timeFilteredEvents.filter((e) => e.category === "DIPLOMACY").length,
      ECONOMY: timeFilteredEvents.filter((e) => e.category === "ECONOMY").length,
      UNREST: timeFilteredEvents.filter((e) => e.category === "UNREST").length,
    };
  }, [timeFilteredEvents]);

  // Event IDs and severities for batch reactions
  const eventIds = useMemo(() => filteredEvents.map((e) => e.id), [filteredEvents]);
  const eventSeverities = useMemo(() => {
    const severities: Record<string, number> = {};
    for (const event of filteredEvents) {
      severities[event.id] = event.severity;
    }
    return severities;
  }, [filteredEvents]);

  const handleToggleCategory = useCallback((category: EventCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        // Don't allow deselecting all
        if (next.size > 1) {
          next.delete(category);
        }
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const handleEventSelect = useCallback(
    (event: GeoEvent) => {
      setSelectedEventId(event.id);
      updateUrlWithEvent(event.id);
      markAsRead(event.id); // Mark as read when selected
      mapRef.current?.flyToEvent(event);
    },
    [updateUrlWithEvent, markAsRead]
  );

  const handleMapEventClick = useCallback(
    (event: GeoEvent) => {
      // Track this click to prevent sidebar toggle interference
      lastMapClickRef.current = Date.now();
      setSelectedEventId(event.id);
      updateUrlWithEvent(event.id);
      markAsRead(event.id); // Mark as read when clicked on map
    },
    [updateUrlWithEvent, markAsRead]
  );

  const handleRequestBriefing = useCallback((event: GeoEvent) => {
    setBriefingEvent(event);
  }, []);

  // ===== TOURING MODES =====
  // Catch Up: fly through all unseen events
  const catchUp = useTouringMode({
    onFlyToEvent: (event, options) => mapRef.current?.flyToEvent(event, options),
    onUpdateUrl: updateUrlWithEvent,
    onMarkAsRead: markAsRead,
    onSelectEvent: setSelectedEventId,
    onStart: () => {
      setInboxOpen(false);
      setSidebarOpen(false);
    },
    label: "catching up",
  });

  // Flyover: fly through filtered events in current sort order
  const flyover = useTouringMode({
    onFlyToEvent: (event, options) => mapRef.current?.flyToEvent(event, options),
    onUpdateUrl: updateUrlWithEvent,
    onMarkAsRead: markAsRead,
    onSelectEvent: setSelectedEventId,
    onStart: () => {
      setSidebarOpen(false);
    },
    label: "in flight",
  });

  // Start catch up with notification inbox events (only if signed in)
  const startCatchUp = useCallback(() => {
    if (!user) return;
    catchUp.start(inboxEvents);
  }, [user, catchUp, inboxEvents]);

  // Sidebar toggle that ignores clicks immediately after a map event click
  // This prevents the toggle button from opening sidebar when clicking dots near the right edge
  const handleSidebarToggle = useCallback(() => {
    // If a map event was clicked within the last 200ms, don't toggle
    // This handles the case where a dot near the right edge triggers both handlers
    if (Date.now() - lastMapClickRef.current < 200) {
      return;
    }
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <BatchReactionsProvider eventIds={eventIds} eventSeverities={eventSeverities}>
      <div className="relative h-screen w-full overflow-hidden bg-background">
        {/* Loading bar during refresh */}
        {isRefreshing && (
          <div className="absolute left-0 right-0 top-0 z-50 h-0.5 overflow-hidden bg-foreground/10">
            <div className="h-full w-1/3 animate-[loading-bar_1s_ease-in-out_infinite] bg-accent" />
          </div>
        )}

        {/* Splash Screen */}
        {showSplash && <SplashScreen onEnter={() => setShowSplash(false)} />}

        {/* Inbox container - Top Left under header */}
        <div className="absolute left-3 top-28 z-40 flex flex-col items-start gap-2 md:left-4 md:top-20 md:gap-3">
          {/* Inbox Button - always visible */}
          <div className="relative">
            <button
              onClick={() => setInboxOpen(!inboxOpen)}
              className="glass-panel relative flex items-center gap-2 px-3 py-2 transition-all hover:scale-105"
              aria-label={
                inboxOpen
                  ? "Close inbox"
                  : `Open inbox${inboxCount > 0 ? `, ${inboxCount} alerts` : ""}`
              }
              aria-expanded={inboxOpen}
            >
              <svg
                className={`h-4 w-4 ${inboxCount > 0 ? "text-accent" : "text-foreground/50"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span className="font-mono text-xs uppercase text-foreground/70">
                {inboxCount > 0
                  ? `${inboxCount} ${inboxCount === 1 ? "ALERT" : "ALERTS"}`
                  : "INBOX"}
              </span>
              {inboxCount > 0 && (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
              )}
            </button>

            {/* Inbox Dropdown */}
            {inboxOpen && (
              <div className="absolute left-0 top-12 w-96 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="glass-panel overflow-hidden">
                  <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium uppercase text-accent">
                        Inbox
                      </span>
                      <span className="font-mono text-[9px] uppercase text-foreground/30">
                        Synced
                      </span>
                      {inboxCount > 0 && (
                        <>
                          <span className="font-mono text-xs text-foreground/40">{inboxCount}</span>
                          {/* Catch Up puck - fly through notification events */}
                          <button
                            onClick={startCatchUp}
                            className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 transition-all hover:bg-accent/20"
                            aria-label={`Catch up on ${inboxCount} alerts`}
                          >
                            <svg
                              className="h-3 w-3 text-accent"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                              />
                            </svg>
                            <span className="font-mono text-[10px] font-medium uppercase text-accent">
                              Catch Up
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                    {inboxCount > 0 && (
                      <button
                        onClick={clearInbox}
                        className="font-mono text-xs text-foreground/40 transition-colors hover:text-foreground"
                        aria-label="Mark all alerts as read"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="custom-scrollbar max-h-80 overflow-y-auto">
                    {/* Inbox not enabled - prompt to set up notifications */}
                    {!inboxPrefsLoading && !inboxPrefs.enabled ? (
                      <div className="px-4 py-8 text-center">
                        <svg
                          className="mx-auto mb-3 h-8 w-8 text-foreground/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                          />
                        </svg>
                        <p className="text-sm text-foreground/70">Notifications not enabled</p>
                        <p className="mt-1 text-xs text-foreground/40">
                          Enable notifications in{" "}
                          <button
                            onClick={() => {
                              setInboxOpen(false);
                              setSettingsOpen(true);
                            }}
                            className="text-accent hover:underline"
                          >
                            Settings
                          </button>
                        </p>
                        {!pushSubscribed && (
                          <p className="mt-2 text-xs text-foreground/30">
                            Push alerts available after enabling
                          </p>
                        )}
                      </div>
                    ) : inboxCount === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <svg
                          className="mx-auto mb-3 h-8 w-8 text-foreground/30"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <p className="text-sm text-foreground/70">All caught up</p>
                        <p className="mt-1 text-xs text-foreground/40">
                          You&apos;ll be notified of major events
                        </p>
                      </div>
                    ) : (
                      inboxEvents.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => {
                            removeFromInbox(event.id);
                            markAsRead(event.id);
                            handleEventSelect(event);
                            setInboxOpen(false);
                          }}
                          className="flex w-full items-start gap-3 border-b border-foreground/5 px-4 py-3 text-left transition-colors last:border-0 hover:bg-foreground/5"
                        >
                          {/* Purple notification dot */}
                          <span className="relative mt-1.5 h-2 w-2 shrink-0">
                            <span
                              className="absolute inset-0 rounded-full"
                              style={{ backgroundColor: CATEGORY_COLORS[event.category] }}
                            />
                            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm text-foreground">{event.title}</p>
                            <p className="mt-0.5 text-xs text-foreground/50">
                              {event.location_name}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span
                              className="font-mono text-xs"
                              style={{ color: CATEGORY_COLORS[event.category] }}
                            >
                              SEV {event.severity}
                            </span>
                            <p className="mt-0.5 font-mono text-[10px] text-foreground/30">
                              {new Date(event.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Severity Filter Button */}
          <div className="relative">
            <button
              onClick={() => setShowSeverityPopover(!showSeverityPopover)}
              className={`glass-panel flex items-center gap-2 px-3 py-2 transition-all hover:scale-105 ${
                minSeverity > 1 ? "ring-1 ring-orange-500/50" : ""
              }`}
              aria-label={`Filter by severity ${minSeverity}+`}
            >
              <svg
                className={`h-4 w-4 ${minSeverity > 1 ? "text-orange-400" : "text-foreground/50"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span
                className={`font-mono text-xs uppercase ${minSeverity > 1 ? "text-orange-400" : "text-foreground/70"}`}
              >
                {minSeverity > 1 ? `SEV ${minSeverity}+` : "SEVERITY"}
              </span>
            </button>

            {/* Severity Popover */}
            {showSeverityPopover && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSeverityPopover(false)} />
                <div className="absolute left-0 top-12 z-40 w-56 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="glass-panel p-4">
                    <div className="mb-3 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/40">
                      Minimum Severity
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-lg font-bold text-orange-400">
                        {minSeverity}+
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        value={minSeverity}
                        onChange={(e) => setMinSeverity(Number(e.target.value))}
                        className="severity-slider flex-1"
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[9px] text-foreground/30">
                      <span>All</span>
                      <span>Critical only</span>
                    </div>
                    {minSeverity > 1 && (
                      <button
                        onClick={() => {
                          setMinSeverity(1);
                          setShowSeverityPopover(false);
                        }}
                        className="mt-3 w-full rounded-lg border border-foreground/10 py-1.5 text-xs text-foreground/50 transition-colors hover:bg-foreground/5"
                      >
                        Reset to All
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Floating Toast Notifications - appear under inbox */}
        </div>

        {/* Globe - events are already deduplicated by worker */}
        <ErrorBoundary fallback={<MapFallback />}>
          <WorldMapWithReactionsAndStates
            ref={mapRef}
            events={filteredEvents}
            onEventClick={handleMapEventClick}
            is2DMode={is2DMode}
            onRequestBriefing={handleRequestBriefing}
            eventStateMap={eventStateMap}
            sidebarOpen={sidebarOpen}
            onClusterFlyover={(events) => flyover.start(events)}
            fetchEventById={fetchEventById}
            externalStack={
              catchUp.isActive && catchUp.events.length > 0
                ? {
                    events: catchUp.events,
                    index: catchUp.currentIndex,
                    onNext: catchUp.next,
                    onPrevious: catchUp.previous,
                    onClose: catchUp.exit,
                    label: catchUp.label,
                  }
                : flyover.isActive && flyover.events.length > 0
                  ? {
                      events: flyover.events,
                      index: flyover.currentIndex,
                      onNext: flyover.next,
                      onPrevious: flyover.previous,
                      onClose: flyover.exit,
                      label: flyover.label,
                    }
                  : undefined
            }
          />
        </ErrorBoundary>

        {/* Events Sidebar - simple list of events */}
        <EventsSidebar
          events={filteredEvents}
          onEventSelect={handleEventSelect}
          selectedEventId={selectedEventId ?? undefined}
          activeCategories={activeCategories}
          onToggleCategory={handleToggleCategory}
          isOpen={sidebarOpen}
          onToggleOpen={handleSidebarToggle}
          eventStateMap={eventStateMap}
          incomingEvents={incomingEvents}
          onStartFlyover={(events) => flyover.start(events)}
        />

        {/* Header - responsive sizing */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 p-3 md:p-4">
          <div className="flex items-start justify-between">
            <div className="pointer-events-auto flex items-center gap-2 md:gap-3">
              <img src="/logo.svg" alt="" className="h-7 w-7 md:h-9 md:w-9" />
              <div>
                <h1 className="font-mono text-base font-bold tracking-tight text-foreground md:text-xl">
                  REALPOLITIK
                </h1>
                <p className="hidden font-mono text-xs uppercase tracking-widest text-foreground/40 md:block">
                  Global Situational Awareness
                </p>
              </div>
              {/* About Info Button */}
              <button
                onClick={() => setAboutOpen(true)}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-full border border-foreground/20 text-foreground/50 transition-colors hover:border-foreground/40 hover:text-foreground/80 md:ml-2 md:h-7 md:w-7"
                aria-label="About Realpolitik"
              >
                <span className="font-mono text-xs font-medium md:text-sm">i</span>
              </button>
            </div>
            <div
              className="text-right font-mono text-[10px] text-foreground/30 transition-all duration-300 md:text-xs"
              style={{ marginRight: sidebarOpen ? "344px" : "32px" }}
            >
              <div className="flex items-center justify-end gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <span>LIVE</span>
              </div>
              {displayedTime && <div className="text-foreground/20">Updated {displayedTime}</div>}
            </div>
          </div>
        </div>

        {/* Time Range Slider - responsive width, shifts left when sidebar open */}
        <div
          className="absolute bottom-4 left-1/2 z-10 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 transition-all duration-300 md:bottom-6 md:w-auto md:max-w-none"
          style={{
            left: sidebarOpen ? "calc(50% - 160px)" : undefined,
          }}
        >
          <div className="glass-panel px-3 py-2 md:px-4 md:py-2.5">
            <div className="flex flex-col items-center gap-1">
              {/* Animated label - only shows when slider is active */}
              <div
                className={`flex items-center gap-2 overflow-hidden transition-all duration-200 ease-out ${
                  isSliderActive ? "max-h-6 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <span className="font-mono text-[9px] text-foreground/50 md:text-[10px]">TIME</span>
                <span className="font-mono text-xs font-medium text-foreground md:text-sm">
                  {availableTimeRanges[clampedTimeRangeIndex]?.label ?? "1W"}
                </span>
              </div>
              <div className="relative w-full md:w-64">
                <input
                  type="range"
                  min={0}
                  max={availableTimeRanges.length - 1}
                  value={clampedTimeRangeIndex}
                  onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
                  onMouseDown={() => setIsSliderActive(true)}
                  onMouseUp={() => setIsSliderActive(false)}
                  onMouseLeave={() => setIsSliderActive(false)}
                  onTouchStart={() => setIsSliderActive(true)}
                  onTouchEnd={() => setIsSliderActive(false)}
                  className="time-slider w-full"
                />
                <div className="mt-1 flex justify-between px-0.5">
                  {availableTimeRanges
                    .filter((_, i) => i % 4 === 0 || i === availableTimeRanges.length - 1)
                    .map((range, i) => (
                      <span
                        key={i}
                        className="font-mono text-[8px] text-foreground/30 md:text-[9px]"
                      >
                        {range.label}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Settings - hidden on mobile, positioned above category legend */}
        <div className="absolute bottom-52 left-4 z-10 hidden flex-col gap-2 md:bottom-48 md:left-6 md:flex">
          <button
            onClick={() => setSettingsOpen(true)}
            className="glass-panel flex items-center gap-2 px-3 py-2 transition-all hover:bg-foreground/10"
            title="Settings"
          >
            <svg
              className="h-4 w-4 text-foreground/70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="font-mono text-xs text-foreground/70">SETTINGS</span>
          </button>
        </div>

        {/* Category Legend - hidden on mobile, shown on desktop */}
        <div className="absolute bottom-20 left-4 z-10 hidden md:bottom-16 md:left-6 md:block">
          <div className="glass-panel relative px-4 py-3">
            <div className="space-y-2 font-mono text-xs">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategories.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => handleToggleCategory(cat)}
                    className={`flex w-full items-center gap-3 transition-opacity ${
                      isActive ? "opacity-100" : "opacity-40"
                    }`}
                    onMouseEnter={() => setHoveredCategory(cat)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                    />
                    <span style={{ color: CATEGORY_COLORS[cat] }}>{cat}</span>
                    <span className="text-foreground/40">{categoryCounts[cat]}</span>
                  </button>
                );
              })}
            </div>

            {/* Tooltip - desktop only */}
            {hoveredCategory && (
              <div className="absolute bottom-full left-0 mb-2 w-64 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <div className="glass-panel px-3 py-2">
                  <div
                    className="mb-1 font-mono text-xs font-medium uppercase"
                    style={{ color: CATEGORY_COLORS[hoveredCategory] }}
                  >
                    {hoveredCategory}
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/70">
                    {CATEGORY_DESCRIPTIONS[hoveredCategory]}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile-only category filter - compact row at top */}
        <div className="absolute left-3 top-14 z-10 md:hidden">
          <div className="glass-panel flex gap-1 px-2 py-1.5">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => handleToggleCategory(cat)}
                  className={`flex items-center gap-1 rounded-full px-2 py-1 transition-opacity ${
                    isActive ? "opacity-100" : "opacity-30"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                  <span className="font-mono text-[10px]" style={{ color: CATEGORY_COLORS[cat] }}>
                    {categoryCounts[cat]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Event Count - hidden on mobile, slides with sidebar on desktop */}
        <div
          className="absolute bottom-6 z-10 hidden transition-all duration-300 md:block"
          style={{ right: sidebarOpen ? "344px" : "24px" }}
        >
          <div className="glass-panel px-4 py-3 text-center">
            <div className="font-mono text-2xl font-bold text-foreground">
              {filteredEvents.length}
            </div>
            <div className="font-mono text-xs uppercase text-foreground/40">Active Events</div>
          </div>
        </div>

        {/* Briefing Modal */}
        {briefingEvent && (
          <BriefingModal event={briefingEvent} onClose={() => setBriefingEvent(null)} />
        )}

        {/* About Modal */}
        <AnimatePresence>
          {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {settingsOpen && (
            <SettingsModal
              onClose={() => setSettingsOpen(false)}
              is2DMode={is2DMode}
              onToggle2DMode={() => setIs2DMode(!is2DMode)}
            />
          )}
        </AnimatePresence>
      </div>
    </BatchReactionsProvider>
  );
}
