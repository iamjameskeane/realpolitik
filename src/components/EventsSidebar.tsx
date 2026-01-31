"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { GeoEvent, EventSource, CATEGORY_COLORS, EventCategory } from "@/types/events";
import { useBatchReactions } from "@/hooks/useBatchReactions";
import { EventVisualState } from "@/hooks/useEventStates";
import { SORT_OPTIONS, SortOption } from "@/lib/constants";

const CATEGORIES: EventCategory[] = ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"];

interface EventsSidebarProps {
  events: GeoEvent[];
  onEventSelect: (event: GeoEvent) => void;
  selectedEventId?: string;
  activeCategories: Set<EventCategory>;
  onToggleCategory: (category: EventCategory) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  /** Event visual states for new/read tracking */
  eventStateMap?: Map<string, EventVisualState>;
  /** New events since last visit */
  incomingEvents?: GeoEvent[];
  /** Callback to start flyover mode with the events to fly over */
  onStartFlyover?: (events: GeoEvent[]) => void;
}

/**
 * Get sources from an event, handling both new and legacy formats.
 * New format: event.sources[]
 * Legacy format: event.source_url + event.source_name
 */
function getEventSources(event: GeoEvent): EventSource[] {
  // New format with sources array
  if (event.sources && event.sources.length > 0) {
    return event.sources;
  }

  // Legacy format - convert to sources array
  if (event.source_url || event.source_name) {
    return [
      {
        id: event.id,
        headline: event.title,
        summary: event.summary,
        source_name: event.source_name || "Unknown",
        source_url: event.source_url || "",
        timestamp: event.timestamp,
      },
    ];
  }

  return [];
}

export function EventsSidebar({
  events,
  onEventSelect,
  selectedEventId,
  activeCategories,
  onToggleCategory,
  isOpen,
  onToggleOpen,
  eventStateMap,
  incomingEvents = [],
  onStartFlyover,
}: EventsSidebarProps) {
  // Initialize sort to "unread" if there are incoming events, else "hot"
  const [sortBy, setSortBy] = useState<SortOption>(() =>
    incomingEvents.length > 0 ? "unread" : "hot"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [hideSeen, setHideSeen] = useState(false);
  const { reactions } = useBatchReactions();

  // Filter events by active categories, search query, and hide seen toggle
  const filteredEvents = useMemo(() => {
    let filtered = events.filter((e) => activeCategories.has(e.category));

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.summary.toLowerCase().includes(query) ||
          (e.location_name && e.location_name.toLowerCase().includes(query))
      );
    }

    // Hide seen/read events if toggle is on
    if (hideSeen && eventStateMap) {
      filtered = filtered.filter((e) => {
        const state = eventStateMap.get(e.id);
        // Keep only incoming and backlog (unread) events
        return state === "incoming" || state === "backlog" || !state;
      });
    }

    return filtered;
  }, [events, activeCategories, searchQuery, hideSeen, eventStateMap]);

  // Sort events based on selected option
  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    switch (sortBy) {
      case "oldest":
        return sorted.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      case "severity":
        return sorted.sort((a, b) => {
          if (b.severity !== a.severity) return b.severity - a.severity;
          return (
            new Date(b.last_updated || b.timestamp).getTime() -
            new Date(a.last_updated || a.timestamp).getTime()
          );
        });
      case "hot":
        // Calculate composite hot score based on: sources, recency, severity, reactions
        return sorted.sort((a, b) => {
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
        return sorted.sort((a, b) => {
          const aVotes = reactions[a.id]?.total || 0;
          const bVotes = reactions[b.id]?.total || 0;
          if (bVotes !== aVotes) return bVotes - aVotes;
          // Tiebreaker: severity
          return b.severity - a.severity;
        });
      case "unread":
        // "What's New" - ONLY show incoming events (new since last visit), sorted by recency
        return sorted
          .filter((e) => {
            const state = eventStateMap?.get(e.id) || "backlog";
            return state === "incoming";
          })
          .sort(
            (a, b) =>
              new Date(b.last_updated || b.timestamp).getTime() -
              new Date(a.last_updated || a.timestamp).getTime()
          );
      case "oldest":
        return sorted.sort(
          (a, b) =>
            new Date(a.last_updated || a.timestamp).getTime() -
            new Date(b.last_updated || b.timestamp).getTime()
        );
      case "recent":
      default:
        return sorted.sort(
          (a, b) =>
            new Date(b.last_updated || b.timestamp).getTime() -
            new Date(a.last_updated || a.timestamp).getTime()
        );
    }
  }, [filteredEvents, sortBy, reactions, eventStateMap]);

  // Count total sources in filtered events
  const filteredSources = filteredEvents.reduce((acc, e) => acc + getEventSources(e).length, 0);

  // Get trending events (hot or critical consensus)
  const trendingEvents = useMemo(() => {
    return filteredEvents
      .filter((e) => {
        const r = reactions[e.id];
        return r?.isHot || r?.consensus === "critical";
      })
      .sort((a, b) => {
        const aR = reactions[a.id];
        const bR = reactions[b.id];
        // Critical consensus first
        if (aR?.consensus === "critical" && bR?.consensus !== "critical") return -1;
        if (bR?.consensus === "critical" && aR?.consensus !== "critical") return 1;
        // Then by vote count
        return (bR?.total || 0) - (aR?.total || 0);
      })
      .slice(0, 3); // Max 3 trending
  }, [filteredEvents, reactions]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<EventCategory, number> = {
      MILITARY: 0,
      DIPLOMACY: 0,
      ECONOMY: 0,
      UNREST: 0,
    };
    events.forEach((e) => {
      counts[e.category] += 1;
    });
    return counts;
  }, [events]);

  return (
    <>
      {/* Toggle button - larger touch target on mobile */}
      <button
        onClick={onToggleOpen}
        className={`fixed top-1/2 z-20 -translate-y-1/2 rounded-l-lg bg-foreground/10 px-3 py-6 backdrop-blur-sm transition-all hover:bg-foreground/20 md:px-2 md:py-4 ${
          isOpen ? "right-[calc(100%-16px)] md:right-80" : "right-0"
        }`}
        aria-label={isOpen ? "Close event sidebar" : "Open event sidebar"}
        aria-expanded={isOpen}
      >
        <svg
          className={`h-6 w-6 text-foreground/70 transition-transform md:h-5 md:w-5 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Sidebar panel - full width on mobile, fixed width on desktop */}
      <div
        className={`fixed right-0 top-0 z-10 flex h-full w-full transform flex-col bg-background/95 backdrop-blur-md transition-transform duration-300 md:w-80 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-foreground/10 px-4 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-medium uppercase tracking-wider text-foreground">
              Event Feed
            </h2>
            <span className="font-mono text-xs text-foreground/40">
              {filteredEvents.length} incidents ({filteredSources} sources)
            </span>
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
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
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full rounded-lg border border-foreground/10 bg-foreground/5 py-2 pl-10 pr-10 font-mono text-xs text-foreground placeholder-foreground/40 outline-none focus:border-accent/50 focus:bg-foreground/10"
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

          {/* Category filter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategories.has(cat);
              const count = categoryCounts[cat];
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase transition-all ${
                    isActive
                      ? "bg-foreground/15 text-foreground"
                      : "bg-foreground/5 text-foreground/30 hover:bg-foreground/10"
                  }`}
                  style={{
                    borderColor: isActive ? CATEGORY_COLORS[cat] : "transparent",
                    borderWidth: "1px",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: isActive ? CATEGORY_COLORS[cat] : "currentColor",
                    }}
                  />
                  {cat}
                  <span className="opacity-50">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Sort toggle - puck style */}
          <div className="mt-3 flex flex-col gap-1.5">
            {/* Row 1: Whats New, Hot, Severity, Reactions */}
            <div className="flex items-center gap-1.5">
              {SORT_OPTIONS.slice(0, 4).map((option) => (
                <div key={option.value} className="group relative">
                  <button
                    onClick={() => setSortBy(option.value)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase transition-all ${
                      sortBy === option.value
                        ? "bg-accent text-white"
                        : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground/80"
                    }`}
                  >
                    {"isPulsing" in option && option.isPulsing && (
                      <span className="relative flex h-2 w-2" suppressHydrationWarning>
                        {incomingEvents.length > 0 ? (
                          <>
                            <span
                              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                sortBy === option.value
                                  ? "bg-white animate-ping"
                                  : "bg-violet-500 animate-ping"
                              }`}
                              suppressHydrationWarning
                            />
                            <span
                              className={`relative inline-flex h-2 w-2 rounded-full ${
                                sortBy === option.value ? "bg-white" : "bg-violet-500"
                              }`}
                              suppressHydrationWarning
                            />
                          </>
                        ) : (
                          <span
                            className={`relative inline-flex h-2 w-2 rounded-full ${
                              sortBy === option.value ? "bg-white/50" : "bg-foreground/30"
                            }`}
                            suppressHydrationWarning
                          />
                        )}
                      </span>
                    )}
                    {option.shortLabel}
                  </button>
                  {/* Styled tooltip */}
                  <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="whitespace-nowrap rounded-md border border-foreground/10 bg-background/95 px-2.5 py-1.5 text-[10px] text-foreground/70 shadow-lg backdrop-blur-md">
                      {option.tooltip}
                    </div>
                    <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-foreground/10 bg-background/95" />
                  </div>
                </div>
              ))}
            </div>
            {/* Row 2: Old, New */}
            <div className="flex items-center gap-1.5">
              {SORT_OPTIONS.slice(4).map((option) => (
                <div key={option.value} className="group relative">
                  <button
                    onClick={() => setSortBy(option.value)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase transition-all ${
                      sortBy === option.value
                        ? "bg-accent text-white"
                        : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground/80"
                    }`}
                  >
                    {option.shortLabel}
                  </button>
                  {/* Styled tooltip */}
                  <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="whitespace-nowrap rounded-md border border-foreground/10 bg-background/95 px-2.5 py-1.5 text-[10px] text-foreground/70 shadow-lg backdrop-blur-md">
                      {option.tooltip}
                    </div>
                    <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t border-foreground/10 bg-background/95" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Flyover and Hide Seen row */}
          <div className="mt-3 flex items-center justify-between">
            {/* Flyover button - left */}
            {onStartFlyover && sortedEvents.length > 0 && (
              <button
                onClick={() => onStartFlyover(sortedEvents)}
                className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 transition-all hover:bg-emerald-500/20"
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
                </svg>
                <span className="font-mono text-[10px] font-medium uppercase text-emerald-400">
                  Flyover ({sortedEvents.length})
                </span>
              </button>
            )}
            {/* Spacer when no flyover */}
            {(!onStartFlyover || sortedEvents.length === 0) && <div />}

            {/* Hide Seen toggle - right, styled like sort pucks */}
            <div className="group relative">
              <button
                onClick={() => setHideSeen(!hideSeen)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase transition-all ${
                  hideSeen
                    ? "bg-violet-500/20 text-violet-400"
                    : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground/80"
                }`}
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {hideSeen ? (
                    /* Closed eye - hiding seen events */
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  ) : (
                    /* Open eye - showing all events */
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </>
                  )}
                </svg>
                Unseen
              </button>
              {/* Styled tooltip */}
              <div className="pointer-events-none absolute right-0 top-full z-50 mt-2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="whitespace-nowrap rounded-md border border-foreground/10 bg-background/95 px-2.5 py-1.5 text-[10px] text-foreground/70 shadow-lg backdrop-blur-md">
                  {hideSeen ? "Showing only unread events" : "Click to hide read events"}
                </div>
                <div className="absolute -top-1 right-3 h-2 w-2 rotate-45 border-l border-t border-foreground/10 bg-background/95" />
              </div>
            </div>
          </div>
        </div>

        {/* Event list with custom scrollbar and bottom padding */}
        <div className="custom-scrollbar flex-1 overflow-y-auto pb-20">
          {/* Trending Section */}
          {trendingEvents.length > 0 && (
            <div className="border-b border-foreground/10 bg-gradient-to-b from-orange-500/5 to-transparent">
              <div className="flex items-center gap-2 px-4 py-2">
                <span className="text-sm">🔥</span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-orange-400">
                  Trending
                </span>
              </div>
              {trendingEvents.map((event) => {
                const eventReaction = reactions[event.id];
                const visualState = eventStateMap?.get(event.id) || "backlog";
                const isIncoming = visualState === "incoming";
                return (
                  <button
                    key={`trending-${event.id}`}
                    onClick={() => onEventSelect(event)}
                    className={`w-full border-b border-foreground/5 px-4 py-2.5 text-left transition-colors hover:bg-foreground/5 last:border-b-0 ${
                      selectedEventId === event.id ? "bg-foreground/10" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="relative h-2 w-2">
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[event.category] }}
                        />
                        {isIncoming && (
                          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                        )}
                      </span>
                      <span className="line-clamp-1 flex-1 text-xs font-medium text-foreground/80">
                        {event.title}
                      </span>
                      {eventReaction?.consensus === "critical" && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                          CRITICAL
                        </span>
                      )}
                      {eventReaction?.isHot && eventReaction?.consensus !== "critical" && (
                        <span className="text-[9px] text-foreground/40">
                          {eventReaction.total} votes
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {sortedEvents.length === 0 ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-foreground/30">
              {sortBy === "unread"
                ? "You're all caught up! No new events since your last visit."
                : "No events match filters"}
            </div>
          ) : (
            sortedEvents.map((event) => {
              const sources = getEventSources(event);
              const hasSources = sources.length > 1;
              const eventReaction = reactions[event.id];
              const isNoise = eventReaction?.consensus === "noise";
              const visualState = eventStateMap?.get(event.id) || "backlog";
              const isIncoming = visualState === "incoming";
              const isRead = visualState === "processed" || visualState === "history";

              return (
                <div
                  key={event.id}
                  className={`border-b border-foreground/5 ${isNoise ? "opacity-50" : ""} ${isRead ? "opacity-60" : ""}`}
                >
                  {/* Main event item - simple list style */}
                  <button
                    onClick={() => onEventSelect(event)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-foreground/5 ${
                      selectedEventId === event.id ? "bg-foreground/10" : ""
                    }`}
                  >
                    {/* Category + Severity + Analyst Consensus + Sources count */}
                    <div className="flex items-center gap-2">
                      <span className="relative h-2 w-2">
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[event.category] }}
                        />
                        {/* Purple notification dot for incoming (new + unread) events */}
                        {isIncoming && (
                          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                        )}
                      </span>
                      <span
                        className="font-mono text-[10px] font-medium uppercase"
                        style={{ color: CATEGORY_COLORS[event.category] }}
                      >
                        {event.category}
                      </span>
                      <span className="font-mono text-[10px] text-foreground/30">
                        SEV {event.severity}
                      </span>
                      {/* Analyst consensus indicator */}
                      {eventReaction?.consensus === "critical" && (
                        <span className="flex items-center gap-0.5 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                          ⚠️ CRITICAL
                        </span>
                      )}
                      {eventReaction?.consensus === "market" && (
                        <span className="flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                          📉 MARKET
                        </span>
                      )}
                      {eventReaction?.consensus === "noise" && (
                        <span className="flex items-center gap-0.5 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                          🧊 NOISE
                        </span>
                      )}
                      {hasSources && (
                        <span className="ml-auto rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[9px] text-foreground/50">
                          {sources.length} sources
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-foreground/90">
                      {event.title}
                    </h3>

                    {/* Location + Time */}
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-foreground/40">
                      {event.location_name && (
                        <>
                          <span>{event.location_name}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>
                        {new Date(event.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
