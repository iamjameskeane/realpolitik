"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { GeoEvent, EventCategory } from "@/types/events";
import { EventEntity } from "@/types/entities";
import { WorldMap, WorldMapHandle } from "../WorldMap";
import { ErrorBoundary } from "../ErrorBoundary";
import { MapFallback } from "../map/MapFallback";
import { IntelligenceSheet, SheetPhase } from "./IntelligenceSheet";
import { SortOption } from "./FilterBar";
import { useViewportHeight } from "@/hooks/useViewportHeight";
import { useEventSelection } from "@/hooks/useEventSelection";
import { useNavigationStack } from "@/hooks/useNavigationStack";
import { BatchReactionsProvider, useBatchReactions } from "@/hooks/useBatchReactions";
import { useEventStates } from "@/hooks/useEventStates";
import { useNotificationInbox } from "@/hooks/useNotificationInbox";
import { useInboxPreferences } from "@/hooks/useInboxPreferences";
import { TIME_DISPLAY_UPDATE_MS, TIME_RANGES, MIN_TIME_RANGE_OPTIONS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/formatters";
import { AnimatePresence } from "framer-motion";
import { AboutModal } from "../AboutModal";
import { SettingsModal } from "../SettingsModal";
import { MobileBriefingModal } from "./BriefingModal";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORIES: EventCategory[] = ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"];
const ALL_CATEGORIES = new Set<EventCategory>(CATEGORIES);

interface MobileLayoutProps {
  events: GeoEvent[];
  lastUpdated?: Date | null;
  isRefreshing?: boolean;
  initialEventId?: string | null;
  /** Callback to expand time range - fetches more data from server */
  onExpandTimeRange?: (hours: number) => Promise<void>;
  /** Maximum hours currently loaded from server */
  maxHoursLoaded?: number;
  /** Fetch a specific event by ID (for on-demand loading) */
  fetchEventById?: (eventId: string) => Promise<GeoEvent | null>;
}

/**
 * Mobile Layout - The "Pilot's View"
 *
 * Three-layer glass stack:
 * - Layer 1: Ambient Globe (z-0) - locked, auto-rotating
 * - Layer 2: HUD (z-10) - logo, live indicator
 * - Layer 3: Intelligence Sheet (z-50) - interactive bottom sheet
 */
export function MobileLayout(props: MobileLayoutProps) {
  // Get event IDs and severities for batch reactions provider
  const eventIds = useMemo(() => props.events.map((e) => e.id), [props.events]);
  const eventSeverities = useMemo(() => {
    const map: Record<string, number> = {};
    props.events.forEach((e) => {
      map[e.id] = e.severity;
    });
    return map;
  }, [props.events]);

  return (
    <BatchReactionsProvider eventIds={eventIds} eventSeverities={eventSeverities}>
      <MobileLayoutInner {...props} />
    </BatchReactionsProvider>
  );
}

function MobileLayoutInner({
  events,
  lastUpdated,
  isRefreshing,
  initialEventId,
  onExpandTimeRange,
  maxHoursLoaded = 24,
  fetchEventById,
}: MobileLayoutProps) {
  const mapRef = useRef<WorldMapHandle>(null);

  // Auth context for gating features
  const { user } = useAuth();

  // Fix Safari viewport height on older iOS
  useViewportHeight();

  // UI State (not related to event selection)
  const [timeRangeIndex, setTimeRangeIndex] = useState(4); // Default to 24H (index 4), will clamp to max available

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
  const [sortBy, setSortBy] = useState<SortOption>("hot");
  const [hideSeen, setHideSeen] = useState(false);
  const [minSeverity, setMinSeverity] = useState(1); // Filter events >= this severity
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(ALL_CATEGORIES);
  const [displayedTime, setDisplayedTime] = useState("");
  const [inboxOpen, setInboxOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [briefingEvent, setBriefingEvent] = useState<GeoEvent | null>(null);
  const [is2DMode, setIs2DMode] = useState(false);
  const [catchUpMode, setCatchUpMode] = useState(false);
  const [catchUpIndex, setCatchUpIndex] = useState(0);
  const [catchUpEvents, setCatchUpEvents] = useState<GeoEvent[]>([]); // Snapshotted unseen events
  const [flyoverMode, setFlyoverMode] = useState(false);
  const [flyoverIndex, setFlyoverIndex] = useState(0);
  const [flyoverEvents, setFlyoverEvents] = useState<GeoEvent[]>([]); // Snapshotted filtered events

  // Cluster view mode (long-press on cluster shows events in that cluster)
  const [clusterViewOpen, setClusterViewOpen] = useState(false);
  const [clusterViewEvents, setClusterViewEvents] = useState<GeoEvent[]>([]);
  const [clusterViewLabel, setClusterViewLabel] = useState("");
  // Track if we're viewing event details from within cluster view (for back navigation)
  const [fromClusterView, setFromClusterView] = useState(false);

  // Navigation stack - replaces fragmented phase/entity state
  const {
    currentFrame,
    canGoBack: stackCanGoBack,
    pushEvent,
    pushEntityList,
    pushEntityBrowser,
    goBack: stackGoBack,
    goToScanner,
    navigateWithinFrame,
  } = useNavigationStack();

  // Derive phase from current frame for backward compatibility
  const phase: SheetPhase = useMemo(() => {
    if (currentFrame.type === "scanner") return "scanner";
    if (currentFrame.type === "entity-list" || currentFrame.type === "entity-browser")
      return "entity";
    return "pilot"; // event frame
  }, [currentFrame.type]);

  // Entity loading state (for async fetch)
  const [entityLoading, setEntityLoading] = useState(false);

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

  // Filter events by time - inbox respects the time slider
  const timeFilteredEvents = useMemo(() => {
    const now = new Date();
    const range = availableTimeRanges[clampedTimeRangeIndex];
    if (!range) return events;
    const cutoff = new Date(now.getTime() - range.hours * 60 * 60 * 1000);
    return events.filter((e) => new Date(e.timestamp) >= cutoff);
  }, [events, clampedTimeRangeIndex, availableTimeRanges]);

  // Event states for "What's New" + "Unread" tracking - uses time-filtered events
  const { incomingEvents, incomingCount, eventStateMap, markAsRead } =
    useEventStates(timeFilteredEvents);

  // Notification inbox - tracks events that arrived via push notifications
  // Uses ALL events (not time-filtered) so notifications don't disappear based on time range
  // Only enabled if user is signed in
  const {
    inboxEvents,
    inboxCount,
    removeFromInbox,
    clearInbox: clearNotificationInbox,
  } = useNotificationInbox(user ? events : []);

  // Inbox preferences - determines if inbox is enabled
  const { preferences: inboxPrefs, isLoading: inboxPrefsLoading } = useInboxPreferences();

  // Smart default sort: "What's New" if there are incoming events, else "Hot"
  const hasSetInitialSort = useRef(false);
  useEffect(() => {
    if (hasSetInitialSort.current) return;
    if (incomingCount > 0) {
      setSortBy("unread");
      hasSetInitialSort.current = true;
    } else if (timeFilteredEvents.length > 0) {
      // If we have events but none are new, mark as initialized
      hasSetInitialSort.current = true;
    }
  }, [incomingCount, timeFilteredEvents.length]);

  // Update displayed time
  useEffect(() => {
    if (!lastUpdated) return;
    const update = () => setDisplayedTime(formatRelativeTime(lastUpdated, true));
    update();
    const interval = setInterval(update, TIME_DISPLAY_UPDATE_MS);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Get reactions for analyst sort
  const { reactions } = useBatchReactions();

  // Track pinned event ID - any event that should be visible regardless of time filter
  // This handles notification deep links and inbox clicks
  const [pinnedEventId, setPinnedEventId] = useState<string | null>(initialEventId || null);

  // Update pinned event when initialEventId changes (notification deep link)
  useEffect(() => {
    if (initialEventId) {
      setPinnedEventId(initialEventId);
    }
  }, [initialEventId]);

  // Filter by category, severity, hide seen, and sort
  // Also include the pinned event even if it's outside the time/category filters
  const filteredEvents = useMemo(() => {
    let filtered = timeFilteredEvents.filter((e) => activeCategories.has(e.category));

    // Filter by minimum severity
    if (minSeverity > 1) {
      filtered = filtered.filter((e) => e.severity >= minSeverity);
    }

    // Hide seen/read events if toggle is on
    if (hideSeen) {
      filtered = filtered.filter((e) => {
        const state = eventStateMap.get(e.id);
        // Keep only incoming and backlog (unread) events
        return state === "incoming" || state === "backlog" || !state;
      });
    }

    // If there's a pinned event that's not in the filtered list, add it
    // This ensures notification/inbox clicks always show the event
    // Note: We bypass ALL filters for pinned events - if user clicked it, they want to see it
    if (pinnedEventId && !filtered.some((e) => e.id === pinnedEventId)) {
      const pinnedEvent = events.find((e) => e.id === pinnedEventId);
      if (pinnedEvent) {
        filtered = [pinnedEvent, ...filtered];
      }
    }

    // Apply sorting
    switch (sortBy) {
      case "oldest":
        return [...filtered].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      case "severity":
        return [...filtered].sort((a, b) => {
          if (b.severity !== a.severity) return b.severity - a.severity;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
      case "hot":
        // Calculate composite hot score based on: sources, recency, severity, reactions
        return [...filtered].sort((a, b) => {
          const aReaction = reactions[a.id];
          const bReaction = reactions[b.id];

          // Calculate hot score for each event
          const calculateHotScore = (event: GeoEvent, reaction: typeof aReaction) => {
            let score = 0;

            // Factor 1: Number of sources (more coverage = hotter)
            // Each source worth 2 points, capped at 5 sources (max 10 points)
            const sourceCount = event.sources?.length || 1;
            score += Math.min(sourceCount, 5) * 2;

            // Factor 2: Recency (newer = hotter, exponential decay)
            // Full 10 points for <1 hour, decays to ~5 at 6 hours, ~2 at 24 hours
            const hoursAgo = (Date.now() - new Date(event.timestamp).getTime()) / (1000 * 60 * 60);
            score += 10 * Math.exp(-hoursAgo / 8);

            // Factor 3: Severity (1-10 points)
            score += event.severity;

            // Factor 4: Reaction engagement (max 10 points)
            const totalVotes = reaction?.total || 0;
            score += Math.min(totalVotes, 10);

            // Bonus: Critical consensus is a strong signal (+20)
            if (reaction?.consensus === "critical") score += 20;

            // Bonus: Hot flag (+5)
            if (reaction?.isHot) score += 5;

            // Penalty: Noise consensus (-15)
            if (reaction?.consensus === "noise") score -= 15;

            return score;
          };

          const aScore = calculateHotScore(a, aReaction);
          const bScore = calculateHotScore(b, bReaction);

          return bScore - aScore;
        });
      case "reactions":
        // Sort by total reaction count (most reactions first)
        return [...filtered].sort((a, b) => {
          const aVotes = reactions[a.id]?.total || 0;
          const bVotes = reactions[b.id]?.total || 0;
          if (bVotes !== aVotes) return bVotes - aVotes;
          // Tiebreaker: severity
          return b.severity - a.severity;
        });
      case "unread":
        // "What's New" - ONLY show incoming events (new since last visit), sorted by recency
        // Exception: always include pinned event so it shows on map
        return [...filtered]
          .filter((e) => {
            // Always include pinned event
            if (e.id === pinnedEventId) return true;
            const state = eventStateMap.get(e.id) || "backlog";
            return state === "incoming";
          })
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      case "recent":
      default:
        // Default: recent (by timestamp descending)
        return [...filtered].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }
  }, [
    timeFilteredEvents,
    activeCategories,
    sortBy,
    reactions,
    eventStateMap,
    hideSeen,
    minSeverity,
    pinnedEventId,
    events,
  ]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<EventCategory, number> = {
      MILITARY: 0,
      DIPLOMACY: 0,
      ECONOMY: 0,
      UNREST: 0,
    };
    timeFilteredEvents.forEach((e) => {
      counts[e.category]++;
    });
    return counts;
  }, [timeFilteredEvents]);

  // Fly to event handler for the hook
  const handleFlyToEvent = useCallback((event: GeoEvent) => {
    mapRef.current?.flyToEvent(event);
  }, []);

  // Use the shared event selection hook
  const {
    selectedEvent,
    selectedIndex,
    stackedEvents,
    stackIndex,
    selectEvent,
    clearSelection,
    navigateNext,
    navigatePrevious,
  } = useEventSelection({
    filteredEvents,
    initialEventId,
    allEvents: events,
    onFlyToEvent: handleFlyToEvent,
    onInitialEventSelect: (event) => pushEvent(event, [event]), // Deep link opens event details
  });

  // Toggle category
  const handleToggleCategory = useCallback((category: EventCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        if (next.size > 1) next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Handle event selection (from list or map)
  const handleEventSelect = useCallback(
    (event: GeoEvent, index: number) => {
      // Pin this event so it stays visible even if outside time filter
      setPinnedEventId(event.id);
      selectEvent(event, index);
      markAsRead(event.id); // Mark as read when selected
      pushEvent(event, [event]); // Push event frame to stack
    },
    [selectEvent, markAsRead, pushEvent]
  );

  // Handle map dot click - find event index and select it
  // Skip flying since the user clicked directly on a visible dot
  const handleMapEventClick = useCallback(
    (event: GeoEvent) => {
      const index = filteredEvents.findIndex((e) => e.id === event.id);
      if (index !== -1) {
        markAsRead(event.id); // Mark as read when clicked on map
        // Pass skipFly=true since the dot is already visible on screen
        selectEvent(event, index, true);
        pushEvent(event, [event]); // Push event frame to stack
      }
    },
    [filteredEvents, selectEvent, markAsRead, pushEvent]
  );

  // Handle phase change / navigation
  const handlePhaseChange = useCallback(
    async (newPhase: SheetPhase) => {
      // Handle back navigation from entity mode
      if (phase === "entity" && (newPhase === "pilot" || newPhase === "scanner")) {
        stackGoBack();

        // Fly to the previous frame's event if it's an event frame
        setTimeout(() => {
          // Re-check current frame after stack update
          const prevFrame = currentFrame;
          if (prevFrame.type === "event") {
            mapRef.current?.flyToEvent(prevFrame.event);
          }
        }, 50);
        return;
      }

      // Handle back to scanner from pilot
      if (newPhase === "scanner") {
        goToScanner();
        clearSelection();
        setPinnedEventId(null);

        // If we came from cluster view, return to cluster view (not main feed)
        if (fromClusterView && clusterViewEvents.length > 0) {
          setFromClusterView(false);
          // Keep cluster view open, just exit touring modes
          setCatchUpMode(false);
          setCatchUpIndex(0);
          setCatchUpEvents([]);
          setFlyoverMode(false);
          setFlyoverIndex(0);
          setFlyoverEvents([]);
          return;
        }

        // Otherwise, exit all modes including cluster view
        setCatchUpMode(false);
        setCatchUpIndex(0);
        setCatchUpEvents([]);
        setFlyoverMode(false);
        setFlyoverIndex(0);
        setFlyoverEvents([]);
        setClusterViewOpen(false);
        setClusterViewEvents([]);
        setClusterViewLabel("");
        setFromClusterView(false);
      }
    },
    [
      phase,
      currentFrame,
      stackGoBack,
      goToScanner,
      clearSelection,
      fromClusterView,
      clusterViewEvents.length,
    ]
  );

  // ===== CATCH UP MODE =====
  // Start catch up - fly through all unseen events in inbox

  const startCatchUp = useCallback(() => {
    if (inboxEvents.length === 0) return;

    setCatchUpEvents(inboxEvents);

    // Start with first event
    const firstEvent = inboxEvents[0];
    setCatchUpMode(true);
    setCatchUpIndex(0);
    setInboxOpen(false); // Close inbox view

    // Select the event and enter pilot phase
    selectEvent(
      firstEvent,
      filteredEvents.findIndex((e) => e.id === firstEvent.id)
    );
    markAsRead(firstEvent.id);
    pushEvent(firstEvent, [firstEvent]);
  }, [inboxEvents, filteredEvents, selectEvent, markAsRead, pushEvent]);

  // Navigate to next event in catch up mode
  const catchUpNext = useCallback(() => {
    const nextIndex = catchUpIndex + 1;

    if (nextIndex >= catchUpEvents.length) {
      // Finished catch up - exit to scanner
      setCatchUpMode(false);
      setCatchUpIndex(0);
      setCatchUpEvents([]);
      goToScanner();
      clearSelection();
      setPinnedEventId(null);
      return;
    }

    // Move to next unseen event
    const nextEvent = catchUpEvents[nextIndex];
    setCatchUpIndex(nextIndex);
    selectEvent(
      nextEvent,
      filteredEvents.findIndex((e) => e.id === nextEvent.id)
    );
    markAsRead(nextEvent.id);
  }, [
    catchUpIndex,
    catchUpEvents,
    filteredEvents,
    selectEvent,
    markAsRead,
    clearSelection,
    goToScanner,
  ]);

  // Navigate to previous event in catch up mode
  const catchUpPrevious = useCallback(() => {
    if (catchUpIndex <= 0) return;

    const prevIndex = catchUpIndex - 1;
    const prevEvent = catchUpEvents[prevIndex];
    setCatchUpIndex(prevIndex);
    selectEvent(
      prevEvent,
      filteredEvents.findIndex((e) => e.id === prevEvent.id)
    );
    markAsRead(prevEvent.id); // Mark as read when viewing
  }, [catchUpIndex, catchUpEvents, filteredEvents, selectEvent, markAsRead]);

  // Exit catch up mode
  const exitCatchUp = useCallback(() => {
    setCatchUpMode(false);
    setCatchUpIndex(0);
    setCatchUpEvents([]);
    goToScanner();
    clearSelection();
    setPinnedEventId(null);
  }, [clearSelection, goToScanner]);

  // ===== FLYOVER MODE =====
  // Fly through all filtered events in order

  const startFlyover = useCallback(() => {
    if (filteredEvents.length === 0) return;

    setFlyoverEvents(filteredEvents);

    // Start with first event
    const firstEvent = filteredEvents[0];
    setFlyoverMode(true);
    setFlyoverIndex(0);

    // Select the event and enter pilot phase
    selectEvent(firstEvent, 0);
    markAsRead(firstEvent.id);
    pushEvent(firstEvent, [firstEvent]);
  }, [filteredEvents, selectEvent, markAsRead, pushEvent]);

  // Navigate to next event in flyover mode
  const flyoverNext = useCallback(() => {
    const nextIndex = flyoverIndex + 1;

    if (nextIndex >= flyoverEvents.length) {
      // Finished flyover - exit to scanner
      setFlyoverMode(false);
      setFlyoverIndex(0);
      setFlyoverEvents([]);
      goToScanner();
      clearSelection();
      setPinnedEventId(null);
      return;
    }

    // Move to next event
    const nextEvent = flyoverEvents[nextIndex];
    setFlyoverIndex(nextIndex);
    selectEvent(nextEvent, nextIndex);
    markAsRead(nextEvent.id);
  }, [flyoverIndex, flyoverEvents, selectEvent, markAsRead, clearSelection, goToScanner]);

  // Navigate to previous event in flyover mode
  const flyoverPrevious = useCallback(() => {
    if (flyoverIndex <= 0) return;

    const prevIndex = flyoverIndex - 1;
    const prevEvent = flyoverEvents[prevIndex];
    setFlyoverIndex(prevIndex);
    selectEvent(prevEvent, prevIndex);
    markAsRead(prevEvent.id);
  }, [flyoverIndex, flyoverEvents, selectEvent, markAsRead]);

  // Exit flyover mode
  const exitFlyover = useCallback(() => {
    setFlyoverMode(false);
    setFlyoverIndex(0);
    setFlyoverEvents([]);
    goToScanner();
    clearSelection();
    setPinnedEventId(null);
  }, [clearSelection, goToScanner]);

  // ===== CLUSTER VIEW MODE =====
  // Long press on a cluster opens cluster details view

  const handleClusterLongPress = useCallback((events: GeoEvent[], locationLabel: string) => {
    // Sort events by severity (highest first)
    const sortedEvents = [...events].sort((a, b) => b.severity - a.severity);
    setClusterViewEvents(sortedEvents);
    setClusterViewLabel(locationLabel);
    setClusterViewOpen(true);
    setInboxOpen(false); // Close inbox if open
  }, []);

  // Handle event selection from cluster view
  const handleClusterEventSelect = useCallback(
    (event: GeoEvent, index: number) => {
      setFromClusterView(true); // Track that we came from cluster view
      selectEvent(event, index);
      markAsRead(event.id);
      pushEvent(event, clusterViewEvents);
    },
    [selectEvent, markAsRead, pushEvent, clusterViewEvents]
  );

  // Exit cluster view (back to main feed)
  const exitClusterView = useCallback(() => {
    setClusterViewOpen(false);
    setClusterViewEvents([]);
    setClusterViewLabel("");
  }, []);

  // Start flyover for cluster events only
  const startClusterFlyover = useCallback(() => {
    if (clusterViewEvents.length === 0) return;

    // Use cluster events for flyover
    setFlyoverEvents(clusterViewEvents);
    setFlyoverMode(true);
    setFlyoverIndex(0);
    setFromClusterView(true); // Return to cluster view after exiting flyover

    // Select first event
    const firstEvent = clusterViewEvents[0];
    selectEvent(
      firstEvent,
      filteredEvents.findIndex((e) => e.id === firstEvent.id)
    );
    markAsRead(firstEvent.id);
    pushEvent(firstEvent, clusterViewEvents);
  }, [clusterViewEvents, filteredEvents, selectEvent, markAsRead, pushEvent]);

  // Handle entity click - fetch full events and push entity-list frame
  const handleEntityClick = useCallback(
    async (entity: EventEntity) => {
      setEntityLoading(true);

      try {
        // Fetch entity event IDs via RPC
        const { getSupabaseClient } = await import("@/lib/supabase");
        const client = getSupabaseClient();
        const { data, error } = await client.rpc("get_entity_events", {
          entity_uuid: entity.entity_id,
          max_count: 20,
        });

        if (error) throw error;

        if (!data || data.length === 0) {
          setEntityLoading(false);
          // Still push frame with empty events to show empty state
          pushEntityList(entity, []);
          return;
        }

        // Fetch full GeoEvent data for each entity event
        const fullEvents: GeoEvent[] = [];
        for (const entityEvent of data) {
          // First check if we already have it in loaded events
          const cached = events.find((e) => e.id === entityEvent.event_id);
          if (cached) {
            fullEvents.push(cached);
          } else if (fetchEventById) {
            // Fetch the full event
            const fetched = await fetchEventById(entityEvent.event_id);
            if (fetched) {
              fullEvents.push(fetched);
            }
          }
        }

        // Push entity-list frame to navigation stack
        pushEntityList(entity, fullEvents);
      } catch (error) {
        console.error("Failed to fetch entity events:", error);
        // Don't push frame on error
      } finally {
        setEntityLoading(false);
      }
    },
    [events, fetchEventById, pushEntityList]
  );

  // Handle event selection from entity list - push entity-browser frame
  const handleEntityEventSelect = useCallback(
    (event: GeoEvent, index: number) => {
      if (currentFrame.type !== "entity-list") return;

      // Push entity-browser frame with the full event list
      pushEntityBrowser(currentFrame.entity, currentFrame.events, index);

      // Mark as read
      markAsRead(event.id);

      // Fly to event
      mapRef.current?.flyToEvent(event);
    },
    [currentFrame, pushEntityBrowser, markAsRead]
  );

  // Handle navigating within entity-browser frame (swipe between entity events)
  const handleNavigateWithinEntity = useCallback(
    (index: number) => {
      navigateWithinFrame(index);

      // Fly to the event at the new index
      if (currentFrame.type === "entity-browser" && currentFrame.events[index]) {
        mapRef.current?.flyToEvent(currentFrame.events[index]);
      }
    },
    [navigateWithinFrame, currentFrame]
  );

  // Handle selecting an entity event to view in full (push new event frame)
  const handleEventFromEntity = useCallback(
    async (event: GeoEvent) => {
      // Push new event frame on top of entity frame
      pushEvent(event, [event]);

      // Mark as read
      markAsRead(event.id);

      // Fly to event
      mapRef.current?.flyToEvent(event);
    },
    [pushEvent, markAsRead]
  );

  // Handle request briefing - open full-screen modal instead of using stack
  const handleRequestBriefing = useCallback((event: GeoEvent) => {
    setBriefingEvent(event);
    setBriefingOpen(true);
  }, []);

  // Close briefing modal
  const handleCloseBriefing = useCallback(() => {
    setBriefingOpen(false);
    // Clear event after animation completes
    setTimeout(() => setBriefingEvent(null), 300);
  }, []);

  // Determine active touring mode (catchUp or flyover)
  const isTouringMode = catchUpMode || flyoverMode;
  const touringEvents = catchUpMode ? catchUpEvents : flyoverMode ? flyoverEvents : stackedEvents;
  const touringIndex = catchUpMode ? catchUpIndex : flyoverMode ? flyoverIndex : stackIndex;
  const touringNext = catchUpMode ? catchUpNext : flyoverMode ? flyoverNext : navigateNext;
  const touringPrevious = catchUpMode
    ? catchUpPrevious
    : flyoverMode
      ? flyoverPrevious
      : navigatePrevious;
  const exitTouring = catchUpMode ? exitCatchUp : exitFlyover;

  return (
    <main
      className="relative w-screen overflow-hidden bg-background"
      style={{
        // Use JS-calculated viewport height for older iOS Safari
        // Falls back to 100dvh (modern browsers) then 100vh (oldest)
        height: "calc(var(--vh, 1vh) * 100)",
      }}
    >
      {/* Loading bar */}
      {isRefreshing && (
        <div
          className="absolute left-0 right-0 z-[60] h-0.5 overflow-hidden bg-foreground/10"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="h-full w-1/3 animate-[loading-bar_1s_ease-in-out_infinite] bg-accent" />
        </div>
      )}

      {/* Layer 1: Interactive Globe - touchable, no popups, no controls */}
      <div className="absolute inset-0 z-0">
        <ErrorBoundary fallback={<MapFallback />}>
          <WorldMap
            ref={mapRef}
            events={filteredEvents}
            is2DMode={is2DMode}
            showPopups={false}
            showControls={false}
            interactive={true}
            onEventClick={handleMapEventClick}
            onClusterLongPress={handleClusterLongPress}
            hasExternalSelection={selectedEvent !== null}
            eventStateMap={eventStateMap}
          />
        </ErrorBoundary>
      </div>

      {/* Layer 2: HUD */}
      <header
        className="absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {/* Logo + Info button */}
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Realpolitik" className="h-8 w-8" />
          <button
            onClick={() => setAboutOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-foreground/20 text-foreground/50 transition-colors hover:border-foreground/40 hover:text-foreground/80 active:scale-95"
            aria-label="About Realpolitik"
          >
            <span className="font-mono text-xs font-medium">i</span>
          </button>
        </div>

        {/* Right side: User Menu + Settings + Live indicator */}
        <div className="flex items-center gap-2">
          {/* Settings button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="glass-panel flex h-8 w-8 items-center justify-center transition-all active:scale-95"
            aria-label="Settings"
          >
            <svg
              className="h-4 w-4 text-foreground/60"
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
          </button>

          {/* Live indicator */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 font-mono text-[10px] text-foreground/50">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span>LIVE</span>
            </div>
            {displayedTime && (
              <div className="font-mono text-[10px] text-foreground/30">{displayedTime}</div>
            )}
          </div>
        </div>
      </header>

      {/* Layer 3: Intelligence Sheet */}
      <IntelligenceSheet
        events={filteredEvents}
        phase={phase}
        onPhaseChange={handlePhaseChange}
        selectedEvent={selectedEvent}
        selectedIndex={selectedIndex}
        onEventSelect={handleEventSelect}
        onNextEvent={touringNext}
        onPreviousEvent={touringPrevious}
        stackedEvents={touringEvents}
        stackIndex={touringIndex}
        // Filters
        timeRangeIndex={clampedTimeRangeIndex}
        onTimeRangeChange={handleTimeRangeChange}
        availableTimeRanges={availableTimeRanges}
        sortBy={sortBy}
        onSortChange={setSortBy}
        activeCategories={activeCategories}
        onToggleCategory={handleToggleCategory}
        categoryCounts={categoryCounts}
        // Event visual states
        eventStateMap={eventStateMap}
        // Inbox - shows events from push notifications
        inboxEvents={inboxEvents}
        inboxCount={inboxCount}
        removeFromInbox={removeFromInbox}
        clearNotificationInbox={clearNotificationInbox}
        notificationsEnabled={inboxPrefs.enabled}
        notificationsLoading={inboxPrefsLoading}
        onOpenSettings={() => setSettingsOpen(true)}
        // What's New - shows only new events since last visit
        incomingEvents={incomingEvents}
        incomingCount={incomingCount}
        inboxOpen={inboxOpen}
        onInboxToggle={() => setInboxOpen(!inboxOpen)}
        // Touring modes (catch up or flyover)
        isTouringMode={isTouringMode}
        catchUpMode={catchUpMode}
        flyoverMode={flyoverMode}
        onStartCatchUp={startCatchUp}
        onStartFlyover={startFlyover}
        onExitTouring={exitTouring}
        // Hide seen toggle
        hideSeen={hideSeen}
        onHideSeenChange={setHideSeen}
        // Severity filter
        minSeverity={minSeverity}
        onMinSeverityChange={setMinSeverity}
        // Cluster view
        clusterViewOpen={clusterViewOpen}
        clusterViewEvents={clusterViewEvents}
        clusterViewLabel={clusterViewLabel}
        onClusterEventSelect={handleClusterEventSelect}
        onExitClusterView={exitClusterView}
        onStartClusterFlyover={startClusterFlyover}
        // Navigation stack
        currentFrame={currentFrame}
        entityLoading={entityLoading}
        onEntityClick={handleEntityClick}
        onEntityEventSelect={handleEntityEventSelect}
        onNavigateWithinEntity={handleNavigateWithinEntity}
        onEventFromEntity={handleEventFromEntity}
        onRequestBriefing={handleRequestBriefing}
      />

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

      {/* Pythia Briefing Modal - Full screen on mobile */}
      <AnimatePresence>
        {briefingOpen && briefingEvent && (
          <MobileBriefingModal event={briefingEvent} onClose={handleCloseBriefing} />
        )}
      </AnimatePresence>
    </main>
  );
}
