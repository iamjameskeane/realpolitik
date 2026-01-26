"use client";

import React, { useState, useCallback } from "react";
import { GeoEvent, CATEGORY_COLORS } from "@/types/events";
import { SourceTimeline } from "../SourceTimeline";
import { ReactionPucks, ReactionResults } from "../reactions";
import { ConsensusBadge } from "../ConsensusBadge";
import { useAuth } from "@/contexts/AuthContext";

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

interface EventPopupProps {
  selectedEvent: GeoEvent;
  stackedEvents: GeoEvent[];
  stackIndex: number;
  style: React.CSSProperties;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRequestBriefing?: (event: GeoEvent) => void;
  /** Label for the stack (e.g., "events here" or "catching up") */
  stackLabel?: string;
}

/**
 * Popup card showing event details with stack navigation for overlapping events.
 */
export function EventPopup({
  selectedEvent,
  stackedEvents,
  stackIndex,
  style,
  onClose,
  onPrevious,
  onNext,
  onRequestBriefing,
  stackLabel = "events here",
}: EventPopupProps) {
  const { user } = useAuth();
  const hasStack = stackedEvents.length > 1;
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "shared">("idle");

  const handleShare = useCallback(async () => {
    const result = await shareEvent(selectedEvent);
    if (result === "copied") {
      setShareStatus("copied");
      setTimeout(() => setShareStatus("idle"), 2000);
    } else if (result === "shared") {
      setShareStatus("shared");
      setTimeout(() => setShareStatus("idle"), 2000);
    }
  }, [selectedEvent]);

  return (
    <div
      className="pointer-events-none absolute z-50 w-[calc(100%-2rem)] max-w-[340px] md:w-[340px]"
      style={style}
    >
      <div className="glass-panel pointer-events-auto flex max-h-[70vh] flex-col p-4">
        {/* Stack navigation (if multiple events at location) */}
        {hasStack && (
          <div className="mb-3 flex shrink-0 items-center justify-between border-b border-foreground/10 pb-3">
            <button
              onClick={onPrevious}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition-colors hover:bg-foreground/20 hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-foreground/70">
                {stackIndex + 1} / {stackedEvents.length}
              </span>
              <span className="text-xs text-foreground/40">{stackLabel}</span>
            </div>
            <button
              onClick={onNext}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 transition-colors hover:bg-foreground/20 hover:text-foreground"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Header - fixed */}
        <div className="shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[selectedEvent.category] }}
              />
              <span
                className="font-mono text-xs font-medium uppercase"
                style={{ color: CATEGORY_COLORS[selectedEvent.category] }}
              >
                {selectedEvent.category}
              </span>
              <span className="font-mono text-xs text-foreground/40">
                SEV: {selectedEvent.severity}/10
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* Close button */}
              <button
                onClick={onClose}
                className="text-foreground/40 transition-colors hover:text-foreground"
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
          </div>

          {/* Location */}
          {selectedEvent.location_name && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-foreground/50">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>{selectedEvent.location_name}</span>
            </div>
          )}

          {/* Title */}
          <h3 className="mt-2 font-medium leading-snug text-foreground">{selectedEvent.title}</h3>

          {/* Consensus Badge */}
          <ConsensusBadge key={selectedEvent.id} eventId={selectedEvent.id} className="mt-2" />

          {/* Timestamp */}
          <p className="mt-1 text-xs text-foreground/40">
            {new Date(selectedEvent.timestamp).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {/* Quick reaction pucks with Share button on right */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <ReactionPucks key={selectedEvent.id} eventId={selectedEvent.id} />
            {/* Share button */}
            <button
              onClick={handleShare}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-foreground/20 bg-foreground/5 text-foreground/50 transition-all hover:bg-foreground/10 hover:text-foreground/70"
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
        </div>

        {/* Scrollable content area */}
        <div className="custom-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto">
          {/* Summary */}
          <p className="text-sm leading-relaxed text-foreground/70">{selectedEvent.summary}</p>

          {/* Auth Banner */}
          {!user && (
            <button
              onClick={() => {
                const { openAuthModal } = require("@/contexts/AuthContext");
                openAuthModal();
              }}
              className="mt-4 w-full rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-center transition-all hover:border-yellow-500/50 hover:bg-yellow-500/15"
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
          {user && selectedEvent.fallout_prediction && (
            <div className="mt-4 rounded border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
                🔮 Fallout Analysis
              </div>
              <p className="text-sm leading-relaxed text-amber-400/90">
                {selectedEvent.fallout_prediction}
              </p>
            </div>
          )}

          {/* Brief Me button - after fallout, before sources */}
          {user && onRequestBriefing && (
            <div className="mt-4 flex flex-col items-center gap-4">
              <button
                onClick={() => onRequestBriefing(selectedEvent)}
                className="btn-shimmer inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-medium uppercase text-indigo-300 backdrop-blur-sm transition-all hover:border-indigo-400/40 hover:bg-indigo-500/15 hover:text-indigo-200"
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
          {selectedEvent.sources && selectedEvent.sources.length > 0 && (
            <SourceTimeline sources={selectedEvent.sources} maxVisible={3} />
          )}

          {/* Analyst consensus results (only shows if there are votes) */}
          <ReactionResults
            key={selectedEvent.id}
            eventId={selectedEvent.id}
            className="mt-4 border-t border-foreground/10 pt-4"
          />
        </div>
      </div>
    </div>
  );
}
