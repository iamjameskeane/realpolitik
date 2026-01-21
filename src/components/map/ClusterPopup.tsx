"use client";

import React from "react";
import { GeoEvent, CATEGORY_COLORS } from "@/types/events";

interface ClusterPopupProps {
  events: GeoEvent[];
  locationLabel: string;
  style: React.CSSProperties;
  onClose: () => void;
  onEventClick: (event: GeoEvent) => void;
  onStartFlyover: () => void;
}

/**
 * Popup card showing cluster details with scrollable event list.
 * Accessible via shift+click or right-click context menu on clusters.
 */
export function ClusterPopup({
  events,
  locationLabel,
  style,
  onClose,
  onEventClick,
  onStartFlyover,
}: ClusterPopupProps) {
  // Sort events by severity (highest first)
  const sortedEvents = [...events].sort((a, b) => b.severity - a.severity);

  return (
    <div
      className="pointer-events-none absolute z-50 w-[calc(100%-2rem)] max-w-[340px] md:w-[340px]"
      style={style}
    >
      <div className="glass-panel pointer-events-auto flex max-h-[70vh] flex-col p-4">
        {/* Header */}
        <div className="shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-sm font-medium uppercase tracking-wider text-foreground">
                Cluster Details
              </span>
              <span className="font-mono text-[10px] text-foreground/40">
                Near {locationLabel} • {events.length} event{events.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Flyover button */}
              <button
                onClick={onStartFlyover}
                className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-medium uppercase text-emerald-400 transition-all hover:border-emerald-400/40 hover:bg-emerald-500/20"
              >
                <svg
                  className="h-3 w-3"
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
                Flyover
              </button>
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
        </div>

        {/* Divider */}
        <div className="my-3 border-t border-foreground/10" />

        {/* Scrollable event list */}
        <div className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto">
          {sortedEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onEventClick(event)}
              className="group w-full rounded-lg border border-foreground/10 bg-foreground/5 p-3 text-left transition-all hover:border-foreground/20 hover:bg-foreground/10"
            >
              {/* Category + Severity */}
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: CATEGORY_COLORS[event.category] }}
                />
                <span
                  className="font-mono text-[10px] font-medium uppercase"
                  style={{ color: CATEGORY_COLORS[event.category] }}
                >
                  {event.category}
                </span>
                <span className="font-mono text-[10px] text-foreground/40">
                  SEV: {event.severity}/10
                </span>
              </div>

              {/* Title */}
              <h4 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-foreground/90 group-hover:text-foreground">
                {event.title}
              </h4>

              {/* Timestamp */}
              <p className="mt-1 text-[10px] text-foreground/40">
                {new Date(event.timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
