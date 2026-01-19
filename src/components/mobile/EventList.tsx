"use client";

import { useMemo } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { GeoEvent, CATEGORY_COLORS } from "@/types/events";
import { useBatchReactions } from "@/hooks/useBatchReactions";
import { EventVisualState } from "@/hooks/useEventStates";

interface EventListProps {
  events: GeoEvent[];
  onEventSelect: (event: GeoEvent) => void;
  eventStateMap?: Map<string, EventVisualState>;
  /** When true, shows inbox-style empty state ("All caught up!") */
  isInboxMode?: boolean;
  /** When true, shows "What's New" empty state */
  isWhatsNewMode?: boolean;
  /** Count of new events since last visit (for What's New puck) */
  incomingCount?: number;
  /** Callback when What's New puck is tapped */
  onWhatsNewTap?: () => void;
  /** Callback when event is swiped to dismiss (inbox mode only) */
  onDismiss?: (eventId: string) => void;
}

/**
 * Compact vertical list of events for Scanner Mode.
 * Shows category dot, headline, severity, and reaction indicators.
 * In inbox mode, events can be swiped to dismiss.
 */
export function EventList({
  events,
  onEventSelect,
  eventStateMap,
  isInboxMode,
  isWhatsNewMode,
  incomingCount,
  onWhatsNewTap,
  onDismiss,
}: EventListProps) {
  const { reactions } = useBatchReactions();

  // Get trending events (hot or critical consensus) - skip in inbox mode
  const trendingEvents = useMemo(() => {
    if (isInboxMode) return [];
    return events
      .filter((e) => {
        const r = reactions[e.id];
        return r?.isHot || r?.consensus === "critical";
      })
      .sort((a, b) => {
        const aR = reactions[a.id];
        const bR = reactions[b.id];
        if (aR?.consensus === "critical" && bR?.consensus !== "critical") return -1;
        if (bR?.consensus === "critical" && aR?.consensus !== "critical") return 1;
        return (bR?.total || 0) - (aR?.total || 0);
      })
      .slice(0, 3);
  }, [events, reactions, isInboxMode]);

  // Get non-trending events
  const regularEvents = useMemo(() => {
    if (isInboxMode) return events;
    const trendingIds = new Set(trendingEvents.map((e) => e.id));
    return events.filter((e) => !trendingIds.has(e.id));
  }, [events, trendingEvents, isInboxMode]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        {isInboxMode || isWhatsNewMode ? (
          <>
            <div className="mb-3 text-4xl">✓</div>
            <p className="font-mono text-sm text-foreground/50">You&apos;re all caught up!</p>
            <p className="mt-1 font-mono text-xs text-foreground/30">
              No new events since your last visit
            </p>
          </>
        ) : (
          <>
            <div className="mb-3 text-4xl">🌍</div>
            <p className="font-mono text-sm text-foreground/50">No events in this time range</p>
            <p className="mt-1 font-mono text-xs text-foreground/30">Try expanding the filter</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
      {/* Trending Section - hidden in inbox mode */}
      {!isInboxMode && trendingEvents.length > 0 && (
        <div className="border-b border-foreground/10 bg-gradient-to-b from-amber-500/5 to-transparent">
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="text-sm">🔥</span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-500">
              Trending
            </span>
          </div>
          <div className="divide-y divide-foreground/5">
            {trendingEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                reaction={reactions[event.id]}
                onSelect={onEventSelect}
                isTrending
                visualState={eventStateMap?.get(event.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular Events / Inbox Items */}
      <div className="divide-y divide-foreground/5">
        {regularEvents.map((event) =>
          isInboxMode && onDismiss ? (
            <SwipeableEventRow
              key={event.id}
              event={event}
              reaction={reactions[event.id]}
              onSelect={onEventSelect}
              onDismiss={onDismiss}
              visualState={eventStateMap?.get(event.id)}
            />
          ) : (
            <EventRow
              key={event.id}
              event={event}
              reaction={reactions[event.id]}
              onSelect={onEventSelect}
              visualState={eventStateMap?.get(event.id)}
            />
          )
        )}
      </div>
    </div>
  );
}

interface EventRowProps {
  event: GeoEvent;
  reaction?: {
    consensus?: string | null;
    isHot?: boolean;
    total?: number;
  };
  onSelect: (event: GeoEvent) => void;
  isTrending?: boolean;
  visualState?: EventVisualState;
}

interface SwipeableEventRowProps extends EventRowProps {
  onDismiss: (eventId: string) => void;
}

/**
 * Get sources from an event, handling both new and legacy formats.
 */
function getEventSources(event: GeoEvent) {
  if (event.sources && event.sources.length > 0) {
    return event.sources;
  }
  if (event.source_url || event.source_name) {
    return [{ id: event.id }];
  }
  return [];
}

/**
 * Swipeable event row for inbox mode - swipe right to dismiss
 */
function SwipeableEventRow({ event, reaction, onSelect, onDismiss, visualState }: SwipeableEventRowProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [0, 150], [1, 0]);
  const scale = useTransform(x, [0, 150], [1, 0.95]);
  const bgOpacity = useTransform(x, [0, 100], [0, 1]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 100) {
      // Swiped far enough - dismiss
      onDismiss(event.id);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Background reveal on swipe */}
      <motion.div
        className="absolute inset-0 flex items-center bg-emerald-500/20 pl-4"
        style={{ opacity: bgOpacity }}
      >
        <div className="flex items-center gap-2 text-emerald-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-mono text-xs font-medium uppercase">Dismiss</span>
        </div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 150 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x, opacity, scale }}
        className="relative bg-background"
      >
        <EventRowContent
          event={event}
          reaction={reaction}
          onSelect={onSelect}
          visualState={visualState}
        />
      </motion.div>
    </div>
  );
}

function EventRow({ event, reaction, onSelect, visualState }: EventRowProps) {
  return (
    <EventRowContent
      event={event}
      reaction={reaction}
      onSelect={onSelect}
      visualState={visualState}
    />
  );
}

function EventRowContent({ event, reaction, onSelect, visualState }: EventRowProps) {
  const isNoise = reaction?.consensus === "noise";
  const isCritical = reaction?.consensus === "critical";
  const isMarket = reaction?.consensus === "market";
  const isIncoming = visualState === "incoming";
  const isRead = visualState === "processed" || visualState === "history";
  const sources = getEventSources(event);
  const hasSources = sources.length > 1;

  return (
    <button
      onClick={() => onSelect(event)}
      className={`w-full px-4 py-3 text-left transition-colors active:bg-foreground/5 ${
        isNoise ? "opacity-50" : ""
      } ${isRead ? "opacity-60" : ""}`}
    >
      {/* Top row: Category + Severity + Consensus badges + Sources count */}
      <div className="flex items-center gap-2">
        <span className="relative shrink-0">
          <span
            className="block h-2 w-2 rounded-full"
            style={{ backgroundColor: CATEGORY_COLORS[event.category] }}
          />
          {isCritical && (
            <span className="absolute -inset-1 animate-ping rounded-full border border-white/40" />
          )}
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
        <span className="font-mono text-[10px] text-foreground/30">SEV {event.severity}</span>

        {/* Consensus badges */}
        {isCritical && (
          <span className="flex items-center gap-0.5 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
            ⚠️ CRITICAL
          </span>
        )}
        {isMarket && (
          <span className="flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
            📉 MARKET
          </span>
        )}
        {isNoise && (
          <span className="flex items-center gap-0.5 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
            🧊 NOISE
          </span>
        )}
        {reaction?.isHot && !isCritical && (
          <span className="font-mono text-[9px] text-amber-500">🔥</span>
        )}

        {/* Sources count */}
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
  );
}
