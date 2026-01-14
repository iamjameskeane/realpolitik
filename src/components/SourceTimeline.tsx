"use client";

import { useState } from "react";
import { EventSource } from "@/types/events";

interface SourceTimelineProps {
  sources: EventSource[];
  /** Maximum sources to show before collapsing (0 = show all) */
  maxVisible?: number;
}

/**
 * Chronological timeline of news sources for an event.
 * Shows when each source reported on the story, building a picture
 * of how the news developed over time.
 */
export function SourceTimeline({ sources, maxVisible = 3 }: SourceTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  // Sort sources by timestamp (oldest first for timeline)
  const sortedSources = [...sources].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const shouldClip = maxVisible > 0 && sources.length > maxVisible;
  const visibleSources =
    shouldClip && !isExpanded ? sortedSources.slice(0, maxVisible) : sortedSources;
  const hiddenCount = shouldClip ? Math.max(0, sources.length - maxVisible) : 0;

  // Format relative time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="mt-4">
      <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/40">
        📰 Source Timeline ({sources.length})
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute bottom-0 left-[5px] top-0 w-px bg-foreground/10" />

        {/* Timeline items */}
        <div className="space-y-3">
          {visibleSources.map((source, index) => (
            <a
              key={source.id}
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative flex gap-3 pl-5 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Timeline dot */}
              <div
                className={`absolute left-0 top-1 h-[11px] w-[11px] rounded-full border-2 transition-colors ${
                  index === 0
                    ? "border-cyan-400 bg-cyan-400/20"
                    : "border-foreground/30 bg-background group-hover:border-cyan-400"
                }`}
              />

              {/* Content */}
              <div className="min-w-0 flex-1">
                {/* Timestamp */}
                <div className="mb-0.5 font-mono text-[10px] text-foreground/40">
                  {formatTime(source.timestamp)}
                </div>

                {/* Source name & headline */}
                <div className="rounded-lg bg-foreground/5 p-2 transition-colors group-hover:bg-foreground/10">
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="h-3 w-3 shrink-0 text-cyan-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    <span className="text-xs font-medium text-cyan-400 group-hover:text-cyan-300">
                      {source.source_name}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-foreground/60 line-clamp-2">
                    {source.headline}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Expand/collapse button */}
        {shouldClip && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-2 w-full pl-5 text-center transition-colors hover:text-foreground/60"
          >
            <span className="font-mono text-[10px] text-foreground/40 hover:text-foreground/60">
              {isExpanded
                ? "Show less"
                : `+${hiddenCount} more source${hiddenCount > 1 ? "s" : ""}`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
