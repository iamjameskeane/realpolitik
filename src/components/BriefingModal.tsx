"use client";

import { useEffect, useCallback } from "react";
import { GeoEvent, CATEGORY_COLORS } from "@/types/events";
import { BriefingChat } from "./briefing";

interface BriefingModalProps {
  event: GeoEvent;
  onClose: () => void;
}

/**
 * Modal overlay for AI Briefing on desktop.
 * Shows event context header and chat interface.
 */
export function BriefingModal({ event, onClose }: BriefingModalProps) {
  // Close on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const categoryColor = CATEGORY_COLORS[event.category];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative mx-4 flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background/95 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-foreground/10 p-5">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: categoryColor }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                />
              </span>
              <span
                className="font-mono text-xs font-medium uppercase tracking-wide"
                style={{ color: categoryColor }}
              >
                Ask Pythia
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold leading-snug text-foreground">
              {event.title}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-foreground/50">
              {event.location_name && <span>{event.location_name}</span>}
              {event.location_name && <span>•</span>}
              <span>
                {new Date(event.timestamp).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-full p-2 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Chat Interface - takes remaining space */}
        <div className="flex-1 overflow-hidden">
          <BriefingChat event={event} className="h-full" />
        </div>
      </div>
    </div>
  );
}
