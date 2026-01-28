"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  TouchEvent as ReactTouchEvent,
} from "react";
import { motion, useAnimation } from "framer-motion";
import { GeoEvent, EventCategory } from "@/types/events";
import { EventList } from "./EventList";
import { EventCard } from "./EventCard";
import { EntityEventList } from "./EntityEventList";
import { EntityBrowser } from "./EntityBrowser";
import { FilterBar, SortOption } from "./FilterBar";
import { BriefingChat } from "../briefing";
import { EventVisualState } from "@/hooks/useEventStates";
import { TimeRange } from "@/lib/constants";
import type { NavigationFrame } from "@/hooks/useNavigationStack";

export type SheetPhase = "scanner" | "pilot" | "analyst" | "entity";

// Sheet height levels (percentage of viewport) - independent of phase
type SheetHeight = "collapsed" | "medium" | "expanded";
const HEIGHT_VALUES: Record<SheetHeight, number> = {
  collapsed: 18,
  medium: 50,
  expanded: 92,
};

// Gesture detection thresholds
const FLICK_VELOCITY_THRESHOLD = 0.35; // px/ms
const FLICK_DISTANCE_THRESHOLD = 40; // px
const CONTENT_SWIPE_DISTANCE = 30; // px - minimum swipe to trigger collapse
const CONTENT_SWIPE_QUICK = 60; // px - quick swipe triggers immediately
const SCROLL_TOP_TOLERANCE = 10; // px - considered "at top" for gesture detection
const SCROLL_EXPAND_THRESHOLD = 40; // px - scroll distance to trigger auto-expand

interface IntelligenceSheetProps {
  events: GeoEvent[];
  phase: SheetPhase;
  onPhaseChange: (phase: SheetPhase) => void;
  selectedEvent: GeoEvent | null;
  selectedIndex: number;
  onEventSelect: (event: GeoEvent, index: number) => void;
  onNextEvent: () => void;
  onPreviousEvent: () => void;
  // Stack navigation (events at same location, or all incoming events in catch up mode)
  stackedEvents: GeoEvent[];
  stackIndex: number;
  // Filters
  timeRangeIndex: number;
  onTimeRangeChange: (index: number) => void;
  availableTimeRanges: readonly TimeRange[];
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  activeCategories: Set<EventCategory>;
  onToggleCategory: (category: EventCategory) => void;
  categoryCounts: Record<EventCategory, number>;
  // Event visual states
  eventStateMap?: Map<string, EventVisualState>;
  // Notification inbox - events from push notifications
  inboxEvents: GeoEvent[];
  inboxCount: number;
  removeFromInbox?: (eventId: string) => void;
  clearNotificationInbox?: () => void;
  notificationsEnabled?: boolean;
  notificationsLoading?: boolean;
  onOpenSettings?: () => void;
  // What's New - only new events since last visit (for Catch Up)
  incomingEvents: GeoEvent[];
  incomingCount: number;
  inboxOpen: boolean;
  onInboxToggle: () => void;
  // Touring modes (catch up through inbox or flyover through filtered events)
  isTouringMode?: boolean;
  catchUpMode?: boolean;
  flyoverMode?: boolean;
  onStartCatchUp?: () => void;
  onStartFlyover?: () => void;
  onExitTouring?: () => void;
  // Hide seen toggle
  hideSeen?: boolean;
  onHideSeenChange?: (value: boolean) => void;
  // Cluster view (long press on cluster shows events in that cluster)
  clusterViewOpen?: boolean;
  clusterViewEvents?: GeoEvent[];
  clusterViewLabel?: string;
  onClusterEventSelect?: (event: GeoEvent, index: number) => void;
  onExitClusterView?: () => void;
  onStartClusterFlyover?: () => void;
  // Navigation stack
  currentFrame: NavigationFrame;
  entityLoading?: boolean;
  onEntityClick?: (entity: import("@/types/entities").EventEntity) => void;
  onEntityEventSelect?: (event: GeoEvent, index: number) => void;
  onNavigateWithinEntity?: (index: number) => void;
  onEventFromEntity?: (event: GeoEvent) => void;
  onRequestBriefing?: (event: GeoEvent) => void;
}

/**
 * The Intelligence Sheet - a draggable bottom sheet.
 *
 * Height and Phase are INDEPENDENT:
 * - Height: collapsed (18%) / medium (50%) / expanded (92%) - controlled by flicks
 * - Phase: scanner / pilot / analyst - controlled by taps (event select, brief me, back)
 */
export function IntelligenceSheet({
  events,
  phase,
  onPhaseChange,
  selectedEvent,
  selectedIndex,
  onEventSelect,
  onNextEvent,
  onPreviousEvent,
  stackedEvents,
  stackIndex,
  timeRangeIndex,
  onTimeRangeChange,
  availableTimeRanges,
  sortBy,
  onSortChange,
  activeCategories,
  onToggleCategory,
  categoryCounts,
  eventStateMap,
  inboxEvents,
  inboxCount,
  removeFromInbox,
  clearNotificationInbox,
  notificationsEnabled,
  notificationsLoading,
  onOpenSettings,
  incomingEvents: _incomingEvents,
  incomingCount,
  inboxOpen,
  onInboxToggle,
  isTouringMode,
  catchUpMode,
  flyoverMode,
  onStartCatchUp,
  onStartFlyover,
  onExitTouring,
  hideSeen,
  onHideSeenChange,
  // Cluster view
  clusterViewOpen,
  clusterViewEvents = [],
  clusterViewLabel = "",
  onClusterEventSelect,
  onExitClusterView,
  onStartClusterFlyover,
  // Navigation stack
  currentFrame,
  entityLoading,
  onEntityClick,
  onEntityEventSelect,
  onNavigateWithinEntity,
  onEventFromEntity,
  onRequestBriefing,
}: IntelligenceSheetProps) {
  const controls = useAnimation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<{ y: number; time: number } | null>(null);
  const contentTouchRef = useRef<{
    y: number;
    time: number;
    scrollTop: number;
    scrollEl: HTMLElement | null;
  } | null>(null);
  const hasExpandedThisScrollRef = useRef(false); // Track if we've auto-expanded during this scroll session
  const isScrollFrozenRef = useRef(false); // Freeze scroll during expansion animation
  const [sheetHeight, setSheetHeight] = useState<SheetHeight>("medium");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // In touring mode, the displayed event comes from the touring stack, not selectedEvent
  // This handles the case where the touring event isn't in filteredEvents (e.g., category filters)
  const displayEvent =
    isTouringMode && stackedEvents.length > 0
      ? (stackedEvents[stackIndex] ?? selectedEvent)
      : selectedEvent;

  // Filter events by search query
  const searchFilteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return events;
    const query = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(query) ||
        e.summary.toLowerCase().includes(query) ||
        (e.location_name && e.location_name.toLowerCase().includes(query))
    );
  }, [events, searchQuery]);

  // Filter inboxEvents by search query as well
  const searchFilteredInboxEvents = useMemo(() => {
    if (!searchQuery.trim()) return inboxEvents;
    const query = searchQuery.toLowerCase();
    return inboxEvents.filter(
      (e) =>
        e.title.toLowerCase().includes(query) ||
        e.summary.toLowerCase().includes(query) ||
        (e.location_name && e.location_name.toLowerCase().includes(query))
    );
  }, [inboxEvents, searchQuery]);

  // Animate to current height (uses --vh for keyboard-aware sizing)
  useEffect(() => {
    controls.start({
      height: `calc(var(--vh, 1vh) * ${HEIGHT_VALUES[sheetHeight]})`,
      transition: { type: "spring", stiffness: 300, damping: 30 },
    });
  }, [sheetHeight, controls]);

  // Smart height adjustments on phase change
  // We preserve user's height choice, but auto-expand in specific cases
  useEffect(() => {
    requestAnimationFrame(() => {
      // Reset scroll expansion flag when phase changes
      hasExpandedThisScrollRef.current = false;

      // Analyst mode (chat) and entity mode need space - expand if not already
      if ((phase === "analyst" || phase === "entity") && sheetHeight !== "expanded") {
        setSheetHeight("expanded");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]); // Only react to phase changes, not sheetHeight

  // When event is selected and sheet is collapsed, expand to show the card
  useEffect(() => {
    if (displayEvent && sheetHeight === "collapsed") {
      requestAnimationFrame(() => {
        setSheetHeight("medium");
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayEvent]); // Only trigger on event change, not sheetHeight

  // Helper to find the actual scrollable element within the content area
  const findScrollableElement = useCallback((): HTMLElement | null => {
    // First check scrollRef (for scanner mode, it's the scrollable element)
    const scrollEl = scrollRef.current;
    if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight) {
      return scrollEl;
    }

    // For pilot/analyst modes, find the scrollable child in the content wrapper
    const wrapper = contentWrapperRef.current;
    if (!wrapper) return null;

    // Look for scrollable elements (EventCard's scroll area, BriefingChat, etc.)
    const scrollableChild = wrapper.querySelector(".overflow-y-auto, .overflow-auto");
    return scrollableChild as HTMLElement | null;
  }, []);

  // Unfreeze scroll on next touch (called from content touch handlers)
  const unfreezeScroll = useCallback(() => {
    if (!isScrollFrozenRef.current) return;
    isScrollFrozenRef.current = false;
    const scrollEl = findScrollableElement();
    if (scrollEl) {
      scrollEl.style.overflowY = "auto";
    }
  }, [findScrollableElement]);

  // Shared scroll handler logic - auto-expand when scrolling down
  const handleScrollLogic = useCallback(
    (scrollTop: number) => {
      // Reset expansion flag when scrolled back to top
      if (scrollTop <= SCROLL_TOP_TOLERANCE) {
        hasExpandedThisScrollRef.current = false;
      }

      // Auto-expand ONLY from medium → expanded when user scrolls down
      // This gives more room to read content (event details or event feed)
      // Collapsed state stays collapsed - user must manually expand via header
      if (
        scrollTop > SCROLL_EXPAND_THRESHOLD &&
        !hasExpandedThisScrollRef.current &&
        sheetHeight === "medium"
      ) {
        hasExpandedThisScrollRef.current = true;

        // Freeze scroll during expansion - prevents content jump
        const scrollEl = findScrollableElement();
        if (scrollEl) {
          isScrollFrozenRef.current = true;
          scrollEl.style.overflowY = "hidden";
        }

        setSheetHeight("expanded");
      }
    },
    [sheetHeight, findScrollableElement]
  );

  // Track scroll position for scanner mode (scrollRef is the scroll container)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    handleScrollLogic(el.scrollTop);
  }, [handleScrollLogic]);

  // Native scroll listener for pilot/analyst modes where scroll is in nested elements
  useEffect(() => {
    // Find the actual scrollable element (may be inside EventCard or BriefingChat)
    const scrollEl = findScrollableElement();
    if (!scrollEl || scrollEl === scrollRef.current) return; // Already handled by handleScroll

    const handleNestedScroll = () => {
      handleScrollLogic(scrollEl.scrollTop);
    };

    scrollEl.addEventListener("scroll", handleNestedScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", handleNestedScroll);
  }, [phase, findScrollableElement, handleScrollLogic, displayEvent]);

  // Touch handlers for flick detection on HEADER - changes HEIGHT, not phase
  const handleTouchStart = useCallback((e: ReactTouchEvent) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: ReactTouchEvent) => {
      if (!touchStartRef.current) return;

      const touchEnd = e.changedTouches[0].clientY;
      const deltaY = touchEnd - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;
      const velocity = Math.abs(deltaY) / deltaTime;

      // Flick detection - header is outside scroll, so no scroll check needed
      const isFlick =
        velocity > FLICK_VELOCITY_THRESHOLD || Math.abs(deltaY) > FLICK_DISTANCE_THRESHOLD;

      if (isFlick) {
        if (deltaY < -CONTENT_SWIPE_DISTANCE) {
          // Flick up - expand
          if (sheetHeight === "collapsed") setSheetHeight("medium");
          else if (sheetHeight === "medium") setSheetHeight("expanded");
        } else if (deltaY > CONTENT_SWIPE_DISTANCE) {
          // Flick down - collapse (header is outside scroll container, always works)
          if (sheetHeight === "expanded") setSheetHeight("medium");
          else if (sheetHeight === "medium") setSheetHeight("collapsed");
        }
      }

      touchStartRef.current = null;
    },
    [sheetHeight]
  );

  // Content touch handlers for collapse at scroll top (Instagram Reels-like)
  // Swipe down at scroll top → collapse, otherwise just scroll normally
  useEffect(() => {
    const el = contentWrapperRef.current;
    if (!el) return;

    const handleContentTouchStart = (e: TouchEvent) => {
      // Unfreeze scroll on new touch (after expansion animation)
      unfreezeScroll();

      const scrollEl = findScrollableElement();
      contentTouchRef.current = {
        y: e.touches[0].clientY,
        time: Date.now(),
        scrollTop: scrollEl?.scrollTop ?? 0,
        scrollEl, // Cache reference for this gesture
      };
    };

    const handleContentTouchMove = (e: TouchEvent) => {
      if (!contentTouchRef.current) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - contentTouchRef.current.y;
      const startScrollTop = contentTouchRef.current.scrollTop;

      // At scroll top, swiping DOWN → intercept to collapse sheet
      if (startScrollTop <= SCROLL_TOP_TOLERANCE && deltaY > 15 && sheetHeight !== "collapsed") {
        e.preventDefault();
      }
    };

    const handleContentTouchEnd = (e: TouchEvent) => {
      if (!contentTouchRef.current) return;

      const {
        y: startY,
        time: startTime,
        scrollTop: startScrollTop,
        scrollEl,
      } = contentTouchRef.current;
      const touchEnd = e.changedTouches[0].clientY;
      const deltaY = touchEnd - startY;
      const deltaTime = Date.now() - startTime;
      const velocity = Math.abs(deltaY) / deltaTime;

      // Use cached scrollEl reference
      const currentScrollTop = scrollEl?.scrollTop ?? 0;

      // Collapse if: started at top, ended at top, and swiped down with enough velocity/distance
      const isSwipeDown = deltaY > CONTENT_SWIPE_DISTANCE;
      const isQuickFlick = velocity > FLICK_VELOCITY_THRESHOLD || deltaY > CONTENT_SWIPE_QUICK;

      if (
        startScrollTop <= SCROLL_TOP_TOLERANCE &&
        currentScrollTop <= SCROLL_TOP_TOLERANCE &&
        isSwipeDown &&
        isQuickFlick
      ) {
        if (sheetHeight === "expanded") {
          setSheetHeight("medium");
        } else if (sheetHeight === "medium") {
          setSheetHeight("collapsed");
        }
      }

      contentTouchRef.current = null;
    };

    el.addEventListener("touchstart", handleContentTouchStart, { capture: true, passive: true });
    el.addEventListener("touchmove", handleContentTouchMove, { capture: true, passive: false });
    el.addEventListener("touchend", handleContentTouchEnd, { capture: true, passive: true });

    return () => {
      el.removeEventListener("touchstart", handleContentTouchStart, { capture: true });
      el.removeEventListener("touchmove", handleContentTouchMove, { capture: true });
      el.removeEventListener("touchend", handleContentTouchEnd, { capture: true });
    };
  }, [sheetHeight, findScrollableElement, unfreezeScroll, phase, displayEvent]); // Re-attach when phase/event changes

  // Handle event selection from list
  const handleEventSelect = useCallback(
    (event: GeoEvent) => {
      // If in inbox mode, remove the event from inbox when clicked
      if (inboxOpen && removeFromInbox) {
        removeFromInbox(event.id);
      }
      // Find index in the full (non-search-filtered) events list for proper navigation
      const index = events.findIndex((e) => e.id === event.id);
      onEventSelect(event, index);
      onPhaseChange("pilot");
      // Clear search when selecting an event
      setSearchQuery("");
      setIsSearchOpen(false);
      setIsSearchFocused(false);
    },
    [events, onEventSelect, onPhaseChange, inboxOpen, removeFromInbox]
  );

  // Handle event selection from cluster view
  const handleClusterEventSelect = useCallback(
    (event: GeoEvent) => {
      const index = clusterViewEvents.findIndex((e) => e.id === event.id);
      onClusterEventSelect?.(event, index);
    },
    [clusterViewEvents, onClusterEventSelect]
  );

  // Handle request briefing
  const handleRequestBriefing = useCallback(() => {
    onPhaseChange("analyst");
  }, [onPhaseChange]);

  // Handle search input focus - track focus state for keyboard offset
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    // Expand sheet to show search results when typing
    if (sheetHeight === "collapsed") {
      setSheetHeight("medium");
    }
  }, [sheetHeight]);

  // Handle search input blur
  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-50"
      style={{
        height: `calc(var(--vh, 1vh) * ${HEIGHT_VALUES[sheetHeight]})`,
        // When search is focused, shift the sheet up by the keyboard height
        // This fixes iOS Safari where fixed bottom elements stay behind the keyboard
        transform: isSearchFocused
          ? "translateY(calc(var(--keyboard-offset, 0px) * -1))"
          : undefined,
        transition: isSearchFocused ? "transform 0.25s ease-out" : undefined,
      }}
      initial={{ y: 0 }}
      animate={controls}
    >
      {/* Sheet container */}
      <div className="flex h-full flex-col rounded-t-3xl bg-background/95 backdrop-blur-xl">
        {/* Swipe zone - changes HEIGHT */}
        <div className="shrink-0" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* Visible drag handle */}
          <div className="flex justify-center py-4">
            <div className="h-1.5 w-12 rounded-full bg-foreground/30" />
          </div>

          {/* Header title */}
          <div className="px-4 pb-3">
            {/* Cluster view has a two-row layout */}
            {phase === "scanner" && clusterViewOpen ? (
              <div className="flex flex-col gap-1">
                {/* Row 1: Back + Title + Flyover */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExitClusterView?.();
                      }}
                      className="mr-1 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10 text-foreground/60 transition-colors active:bg-foreground/20"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-foreground">
                      Cluster Details
                    </h2>
                  </div>
                  {/* Flyover button */}
                  {clusterViewEvents.length > 0 && onStartClusterFlyover && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartClusterFlyover();
                      }}
                      className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 transition-all active:scale-95"
                    >
                      <svg
                        className="h-3 w-3 text-emerald-400"
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
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="font-mono text-[10px] font-medium uppercase text-emerald-400">
                        Flyover
                      </span>
                    </button>
                  )}
                </div>
                {/* Row 2: Location + count - ml-10 = w-7 (button) + mr-1 + gap-2 */}
                <div className="ml-10 font-mono text-[10px] text-foreground/40">
                  Near {clusterViewLabel} • {clusterViewEvents.length} event
                  {clusterViewEvents.length !== 1 ? "s" : ""}
                </div>
              </div>
            ) : (
              /* Standard single-row layout for other modes */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Back button for pilot/analyst modes OR inbox mode */}
                  {(phase !== "scanner" || inboxOpen) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (phase === "scanner" && inboxOpen) {
                          // In inbox view, back closes inbox
                          onInboxToggle();
                        } else if (phase !== "scanner") {
                          // In pilot/analyst/entity, go back to previous view (inbox stays open if it was)
                          if (phase === "entity") {
                            onPhaseChange("pilot"); // Entity always goes back to pilot
                          } else {
                            onPhaseChange(phase === "analyst" ? "pilot" : "scanner");
                          }
                        }
                      }}
                      className="mr-1 flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10 text-foreground/60 transition-colors active:bg-foreground/20"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                  )}
                  <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-foreground">
                    {phase === "scanner" && (inboxOpen ? "Notifications" : "Event Feed")}
                    {phase === "pilot" &&
                      (isTouringMode ? (catchUpMode ? "Catching Up" : "Flyover") : "Event Details")}
                    {phase === "analyst" && "Ask Pythia"}
                    {phase === "entity" &&
                      (currentFrame.type === "entity-list" ||
                        currentFrame.type === "entity-browser") &&
                      currentFrame.entity.name}
                  </h2>
                  {/* Event count for scanner mode - only show in feed, not inbox */}
                  {phase === "scanner" && !inboxOpen && (
                    <span className="font-mono text-xs text-foreground/40">
                      {searchFilteredEvents.length}
                    </span>
                  )}
                  {/* Flyover button - in feed mode (not inbox, not cluster view) */}
                  {phase === "scanner" &&
                    !inboxOpen &&
                    !clusterViewOpen &&
                    searchFilteredEvents.length > 0 &&
                    onStartFlyover && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartFlyover();
                        }}
                        className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 transition-all active:scale-95"
                      >
                        <svg
                          className="h-3 w-3 text-emerald-400"
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
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="font-mono text-[10px] font-medium uppercase text-emerald-400">
                          Flyover
                        </span>
                      </button>
                    )}
                  {phase === "pilot" && isTouringMode && (
                    <span
                      className={`font-mono text-xs ${catchUpMode ? "text-accent" : "text-emerald-400"}`}
                    >
                      {stackIndex + 1} / {stackedEvents.length}
                    </span>
                  )}
                </div>

                {/* Right side buttons */}
                {phase === "scanner" && !clusterViewOpen && (
                  <div className="flex items-center gap-2">
                    {inboxOpen ? (
                      /* Inbox mode: show Catch Up + Read All */
                      <>
                        {inboxCount > 0 && onStartCatchUp && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartCatchUp();
                            }}
                            className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 transition-all active:scale-95"
                          >
                            <svg
                              className="h-3.5 w-3.5 text-accent"
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
                        )}
                        {inboxCount > 0 && clearNotificationInbox && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotificationInbox();
                            }}
                            className="flex items-center gap-1 rounded-full border border-foreground/20 bg-foreground/5 px-2.5 py-1 transition-all active:scale-95"
                          >
                            <svg
                              className="h-3.5 w-3.5 text-foreground/60"
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
                            <span className="font-mono text-[10px] font-medium uppercase text-foreground/60">
                              Read All
                            </span>
                          </button>
                        )}
                      </>
                    ) : (
                      /* Feed mode: show Search + Inbox bell */
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSearchOpen) {
                              setSheetHeight("expanded");
                            } else {
                              setSearchQuery("");
                              setIsSearchFocused(false);
                            }
                            setIsSearchOpen(!isSearchOpen);
                          }}
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-95 ${
                            isSearchOpen ? "bg-accent/20" : "bg-foreground/10"
                          }`}
                        >
                          <svg
                            className={`h-4 w-4 ${isSearchOpen ? "text-accent" : "text-foreground/40"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onInboxToggle();
                          }}
                          className={`relative flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-95 ${
                            inboxOpen ? "bg-accent/20" : "bg-foreground/10"
                          }`}
                        >
                          <svg
                            className={`h-4 w-4 ${inboxCount > 0 ? "text-accent" : "text-foreground/40"}`}
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
                          {inboxCount > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white">
                              {inboxCount > 99 ? "99+" : inboxCount}
                            </span>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search bar - expandable (hidden in cluster view and inbox mode) */}
          {phase === "scanner" && isSearchOpen && !clusterViewOpen && !inboxOpen && (
            <div className="px-4 pb-3">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                  placeholder="Search events..."
                  className="w-full rounded-full border border-foreground/10 bg-foreground/5 py-2 pl-10 pr-10 font-mono text-sm text-foreground placeholder-foreground/40 outline-none focus:border-accent/50 focus:bg-foreground/10"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60"
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
                )}
              </div>
              {searchQuery && (
                <div className="mt-1 text-center font-mono text-[10px] text-foreground/40">
                  {searchFilteredEvents.length} result{searchFilteredEvents.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-b border-foreground/10" />

        {/* Filter bar - only in scanner mode, hidden when viewing inbox or cluster */}
        {phase === "scanner" && !inboxOpen && !clusterViewOpen && (
          <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <FilterBar
              timeRangeIndex={timeRangeIndex}
              onTimeRangeChange={onTimeRangeChange}
              availableTimeRanges={availableTimeRanges}
              sortBy={sortBy}
              onSortChange={onSortChange}
              activeCategories={activeCategories}
              onToggleCategory={onToggleCategory}
              categoryCounts={categoryCounts}
              incomingCount={incomingCount}
              hideSeen={hideSeen}
              onHideSeenChange={onHideSeenChange}
            />
          </div>
        )}

        {/* Content area - scrolling expands, but collapse only from header */}
        <div ref={contentWrapperRef} className="min-h-0 flex-1 overflow-hidden">
          {phase === "scanner" && (
            <div
              ref={scrollRef}
              className="custom-scrollbar h-full overflow-y-auto overscroll-contain"
              onScroll={handleScroll}
            >
              {clusterViewOpen ? (
                // Cluster view - show events from the selected cluster
                <EventList
                  events={clusterViewEvents}
                  onEventSelect={handleClusterEventSelect}
                  eventStateMap={eventStateMap}
                />
              ) : inboxOpen && notificationsLoading !== true && notificationsEnabled === false ? (
                // Inbox is open but notifications not set up
                <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
                  <svg
                    className="mb-4 h-12 w-12 text-foreground/20"
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
                  <p className="mb-2 text-sm font-medium text-foreground/70">
                    Notifications not enabled
                  </p>
                  <p className="mb-4 text-xs text-foreground/40">
                    Enable notifications in Settings to track events
                  </p>
                  <button
                    onClick={() => {
                      onInboxToggle(); // Close inbox first
                      onOpenSettings?.();
                    }}
                    className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
                  >
                    Open Settings
                  </button>
                </div>
              ) : inboxOpen && inboxCount === 0 ? (
                // Inbox is open, notifications enabled, but no events
                <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
                  <svg
                    className="mb-4 h-12 w-12 text-foreground/20"
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
                  <p className="mb-2 text-sm font-medium text-foreground/70">All caught up</p>
                  <p className="text-xs text-foreground/40">
                    You&apos;ll be notified when major events occur
                  </p>
                </div>
              ) : (
                // Normal feed or inbox with events
                <EventList
                  events={inboxOpen ? searchFilteredInboxEvents : searchFilteredEvents}
                  onEventSelect={handleEventSelect}
                  eventStateMap={eventStateMap}
                  isInboxMode={inboxOpen}
                  isWhatsNewMode={!inboxOpen && sortBy === "unread"}
                  incomingCount={incomingCount}
                  onWhatsNewTap={onInboxToggle}
                  onDismiss={inboxOpen ? removeFromInbox : undefined}
                />
              )}
            </div>
          )}

          {phase === "pilot" && displayEvent && (
            <div
              ref={scrollRef}
              className="flex h-full flex-col overflow-hidden pt-2"
              onScroll={handleScroll}
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <EventCard
                event={displayEvent}
                currentIndex={selectedIndex}
                totalCount={events.length}
                stackedEvents={stackedEvents}
                stackIndex={stackIndex}
                onNext={onNextEvent}
                onPrevious={onPreviousEvent}
                onRequestBriefing={() => onRequestBriefing?.(displayEvent)}
                isTouringMode={isTouringMode}
                catchUpMode={catchUpMode}
                flyoverMode={flyoverMode}
                onExitTouring={onExitTouring}
                onEntityClick={onEntityClick}
              />
            </div>
          )}

          {/* Entity list view - shows feed of events for entity */}
          {phase === "entity" && currentFrame.type === "entity-list" && !entityLoading && (
            <div
              ref={scrollRef}
              className="custom-scrollbar h-full overflow-y-auto overscroll-contain"
              onScroll={handleScroll}
            >
              <EntityEventList
                entity={currentFrame.entity}
                events={currentFrame.events}
                onEventSelect={onEntityEventSelect ?? (() => {})}
                onBack={() => onPhaseChange("scanner")}
                eventStateMap={eventStateMap}
              />
            </div>
          )}

          {/* Entity browser view - swipeable event cards within entity */}
          {phase === "entity" && currentFrame.type === "entity-browser" && !entityLoading && (
            <div
              ref={scrollRef}
              className="flex h-full flex-col overflow-hidden"
              onScroll={handleScroll}
            >
              <EntityBrowser
                entity={currentFrame.entity}
                events={currentFrame.events}
                currentIndex={currentFrame.index}
                onNavigate={onNavigateWithinEntity ?? (() => {})}
                onEventClick={onEventFromEntity ?? (() => {})}
                onEntityClick={onEntityClick ?? (() => {})}
                onRequestBriefing={onRequestBriefing ?? (() => {})}
                onBack={() => onPhaseChange("scanner")}
              />
            </div>
          )}

          {phase === "entity" && entityLoading && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-accent" />
                <p className="font-mono text-xs text-foreground/40">Loading events...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
