"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";
import { GeoEvent, CATEGORY_COLORS } from "@/types/events";
import { SourceTimeline } from "../SourceTimeline";
import { ReactionPucks, ReactionResults } from "../reactions";
import { ConsensusBadge } from "../ConsensusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { EntityList } from "../entities";
import { useEventEntities } from "@/hooks/useEventEntities";

// Helper to share an event
async function shareEvent(event: GeoEvent): Promise<"shared" | "copied" | "error"> {
  const url = typeof window !== "undefined" ? `${window.location.origin}/?event=${event.id}` : "";
  const shareData = {
    title: event.title,
    text: `${event.category} - ${event.title}`,
    url,
  };

  // Try native share API first (mobile)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(shareData);
      return "shared";
    } catch (e) {
      // User cancelled or error - fall through to clipboard
      if ((e as Error).name === "AbortError") return "error";
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "error";
  }
}

interface EventCardProps {
  event: GeoEvent;
  currentIndex: number;
  totalCount: number;
  stackedEvents: GeoEvent[];
  stackIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onRequestBriefing?: () => void;
  // Touring modes (catch up or flyover)
  isTouringMode?: boolean;
  catchUpMode?: boolean;
  flyoverMode?: boolean;
  onExitTouring?: () => void;
}

/**
 * Single event card for Pilot Mode.
 * - Horizontal swipe: navigate between events
 * - Vertical scroll: read more content
 */
export function EventCard({
  event,
  currentIndex: _currentIndex,
  totalCount: _totalCount,
  stackedEvents,
  stackIndex,
  onNext,
  onPrevious,
  onRequestBriefing,
  isTouringMode,
  catchUpMode,
  flyoverMode,
  onExitTouring,
}: EventCardProps) {
  const { user, openAuthModal } = useAuth();
  // currentIndex and totalCount kept for API compatibility but not displayed for single events
  void _currentIndex;
  void _totalCount;
  const hasStack = stackedEvents.length > 1;
  const isLastInTouring = isTouringMode && stackIndex === stackedEvents.length - 1;
  const controls = useAnimation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");
  const { entities } = useEventEntities(event.id);

  const handleShare = useCallback(async () => {
    const result = await shareEvent(event);
    if (result === "copied") {
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } else if (result === "shared") {
      setShareStatus("shared");
      setTimeout(() => setShareStatus("idle"), 2000);
    }
  }, [event]);

  // Reset scroll to top when event changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [event.id]);

  const handleDragEnd = useCallback(
    async (_: MouseEvent | globalThis.TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 50;
      const velocity = info.velocity.x;
      const offset = info.offset.x;

      if (offset < -threshold || velocity < -500) {
        // Swiped left -> next event
        await controls.start({ x: -100, opacity: 0, transition: { duration: 0.15 } });
        onNext();
        controls.set({ x: 100, opacity: 0 });
        await controls.start({ x: 0, opacity: 1, transition: { duration: 0.15 } });
      } else if (offset > threshold || velocity > 500) {
        // Swiped right -> previous event
        await controls.start({ x: 100, opacity: 0, transition: { duration: 0.15 } });
        onPrevious();
        controls.set({ x: -100, opacity: 0 });
        await controls.start({ x: 0, opacity: 1, transition: { duration: 0.15 } });
      } else {
        // Snap back
        controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
      }
    },
    [controls, onNext, onPrevious]
  );

  const categoryColor = CATEGORY_COLORS[event.category];

  return (
    <motion.div
      className="flex h-full flex-col px-4"
      animate={controls}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      style={{ touchAction: "pan-y" }}
    >
      {/* Touring mode progress indicator (catch up or flyover) */}
      {isTouringMode && (
        <div className="mb-2 flex shrink-0 items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <svg
              className={`h-4 w-4 ${catchUpMode ? "text-accent" : "text-emerald-400"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span
              className={`font-mono text-xs font-medium ${catchUpMode ? "text-accent" : "text-emerald-400"}`}
            >
              {stackIndex + 1} / {stackedEvents.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-foreground/10">
            <div
              className={`h-full rounded-full transition-all duration-300 ${catchUpMode ? "bg-accent" : "bg-emerald-400"}`}
              style={{ width: `${((stackIndex + 1) / stackedEvents.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Stack navigation indicator - only show when multiple events at same location (not in touring mode) */}
      {hasStack && !isTouringMode && (
        <div className="mb-2 flex shrink-0 items-center justify-center gap-2">
          <svg
            className="h-3 w-3 text-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
          <span className="font-mono text-[10px] text-foreground/50">
            {stackIndex + 1} of {stackedEvents.length} events here
          </span>
          <div className="flex gap-1">
            {stackedEvents.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === stackIndex ? "w-3 bg-accent" : "w-1.5 bg-foreground/20"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Card content - fills available space */}
      <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Header - fixed */}
        <div className="flex shrink-0 items-center justify-between border-b border-foreground/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColor }} />
            <span
              className="font-mono text-xs font-medium uppercase"
              style={{ color: categoryColor }}
            >
              {event.category}
            </span>
          </div>
          <span
            className="rounded px-2 py-0.5 font-mono text-xs font-bold"
            style={{
              backgroundColor: `${categoryColor}20`,
              color: categoryColor,
            }}
          >
            SEV {event.severity}
          </span>
        </div>

        {/* Scrollable content */}
        <div
          ref={scrollRef}
          className="custom-scrollbar flex-1 overflow-y-auto overscroll-contain p-4"
          style={{ touchAction: "pan-y" }}
        >
          {/* Title */}
          <h2 className="text-lg font-semibold leading-snug text-foreground">{event.title}</h2>

          {/* Consensus Badge */}
          <ConsensusBadge eventId={event.id} className="mt-2" />

          {/* Location & Date - right under title like desktop */}
          <div className="mt-1.5 flex items-center gap-2 text-xs text-foreground/40">
            {event.location_name && (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                </svg>
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

          {/* Quick reaction pucks with Share button on right */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <ReactionPucks eventId={event.id} />
            {/* Share button */}
            <button
              onClick={handleShare}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/20 bg-foreground/5 text-foreground/50 transition-all active:scale-95 active:bg-foreground/10"
              title="Share event"
            >
              {shareStatus === "copied" ? (
                <svg
                  className="h-4 w-4 text-emerald-400"
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
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* Summary */}
          <p className="mt-3 text-sm leading-relaxed text-foreground/70">{event.summary}</p>

          {/* Entity badges */}
          {entities.length > 0 && (
            <div className="mt-3">
              <EntityList entities={entities} maxVisible={4} />
            </div>
          )}

          {/* Auth Banner */}
          {!user && (
            <button
              onClick={() => openAuthModal()}
              className="mt-4 w-full rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center transition-all active:scale-[0.98]"
            >
              <div className="font-mono text-xs uppercase tracking-wide text-yellow-400">
                Sign in to access smart features
              </div>
              <div className="mt-1 text-xs text-yellow-400/70">
                Reactions • Fallout Analysis • AI Briefing
              </div>
            </button>
          )}

          {/* Fallout Analysis */}
          {user && event.fallout_prediction && (
            <div className="mt-4 rounded border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
                🔮 Fallout Analysis
              </div>
              <p className="text-sm leading-relaxed text-amber-400/90">
                {event.fallout_prediction}
              </p>
            </div>
          )}

          {/* Brief Me button - after fallout, before sources */}
          {user && onRequestBriefing && (
            <div className="mt-4 flex flex-col items-center gap-4">
              <button
                onClick={onRequestBriefing}
                className="btn-shimmer inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-medium uppercase text-indigo-300 backdrop-blur-sm transition-all active:scale-95 active:bg-indigo-500/20"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                  <path d="M20 3v4" />
                  <path d="M22 5h-4" />
                </svg>
                Brief Me
              </button>
              <div className="w-full border-t border-foreground/10" />
            </div>
          )}

          {/* Source Timeline */}
          {event.sources && event.sources.length > 0 && (
            <SourceTimeline sources={event.sources} maxVisible={3} />
          )}

          {/* Analyst consensus results (only shows if there are votes) */}
          <ReactionResults eventId={event.id} className="mt-4 border-t border-foreground/10 pt-4" />

          {/* Safe area spacer for iOS Safari bottom bar */}
          <div
            className="shrink-0"
            style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
          />
        </div>
      </div>

      {/* Touring mode swipe hints / finish button */}
      {isTouringMode && (
        <div className="mt-2 flex shrink-0 flex-col items-center gap-2 px-4">
          {isLastInTouring ? (
            <button
              onClick={onExitTouring}
              className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono text-xs font-medium text-white transition-all active:scale-95 ${
                catchUpMode ? "bg-accent" : "bg-emerald-500"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {catchUpMode ? "All Caught Up!" : "Flyover Complete!"}
            </button>
          ) : (
            <span className="text-[10px] text-foreground/30">← swipe to navigate →</span>
          )}
        </div>
      )}

      {/* Swipe hints - only show when there's a stack to navigate (not in touring mode) */}
      {hasStack && !isTouringMode && (
        <div className="mt-2 flex shrink-0 items-center justify-center px-4 text-[10px] text-foreground/30">
          <span>← swipe to navigate stack →</span>
        </div>
      )}
    </motion.div>
  );
}
