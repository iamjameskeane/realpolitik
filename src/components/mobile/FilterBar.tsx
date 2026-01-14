"use client";

import { useState, useCallback } from "react";
import { EventCategory, CATEGORY_COLORS } from "@/types/events";
import { TimeRange, SORT_OPTIONS, SortOption } from "@/lib/constants";

const CATEGORIES: EventCategory[] = ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"];

interface FilterBarProps {
  // Time
  timeRangeIndex: number;
  onTimeRangeChange: (index: number) => void;
  availableTimeRanges: readonly TimeRange[];
  // Sort
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  // Categories
  activeCategories: Set<EventCategory>;
  onToggleCategory: (category: EventCategory) => void;
  categoryCounts: Record<EventCategory, number>;
  // Incoming count for "What's New" indicator
  incomingCount?: number;
  // Hide seen toggle
  hideSeen?: boolean;
  onHideSeenChange?: (value: boolean) => void;
}

/**
 * Compact filter bar with popovers for mobile.
 * - Sort toggle (Recent / Severity)
 * - Time range popover
 * - Categories popover
 */
export function FilterBar({
  timeRangeIndex,
  onTimeRangeChange,
  availableTimeRanges,
  sortBy,
  onSortChange,
  activeCategories,
  onToggleCategory,
  categoryCounts,
  incomingCount = 0,
  hideSeen = false,
  onHideSeenChange,
}: FilterBarProps) {
  const [showTimePopover, setShowTimePopover] = useState(false);
  const [showCategoryPopover, setShowCategoryPopover] = useState(false);
  const [showSortHelp, setShowSortHelp] = useState(false);

  const activeCount = activeCategories.size;
  const currentTimeLabel = availableTimeRanges[timeRangeIndex]?.label || "1W";

  // Close popovers when clicking outside
  const handleTimeSelect = useCallback(
    (index: number) => {
      onTimeRangeChange(index);
      setShowTimePopover(false);
    },
    [onTimeRangeChange]
  );

  const handleCategoryToggle = useCallback(
    (cat: EventCategory) => {
      onToggleCategory(cat);
    },
    [onToggleCategory]
  );

  // Get current sort option for display
  const currentSortOption = SORT_OPTIONS.find((o) => o.value === sortBy) || SORT_OPTIONS[0];

  return (
    <div className="relative px-4 py-2">
      <div className="flex items-center justify-between gap-2">
        {/* Sort button - left aligned */}
        <button
          onClick={() => {
            setShowSortHelp(!showSortHelp);
            setShowTimePopover(false);
            setShowCategoryPopover(false);
          }}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-medium uppercase transition-all ${
            showSortHelp
              ? "border-accent bg-accent/10 text-accent"
              : "border-foreground/20 bg-foreground/5 text-foreground/60"
          }`}
        >
          {"isPulsing" in currentSortOption && currentSortOption.isPulsing && (
            <span className="relative flex h-2 w-2">
              {incomingCount > 0 ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                </>
              ) : (
                <span className="relative inline-flex h-2 w-2 rounded-full bg-foreground/30" />
              )}
            </span>
          )}
          <span key={sortBy} className="inline-block animate-[fadeSlideIn_0.2s_ease-out]">
            {currentSortOption.shortLabel}
          </span>
          <svg
            className={`h-3 w-3 transition-transform ${showSortHelp ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Time & Category buttons - right aligned */}
        <div className="flex items-center gap-2">
          {/* Time range button */}
          <button
            onClick={() => {
              setShowTimePopover(!showTimePopover);
              setShowCategoryPopover(false);
              setShowSortHelp(false);
            }}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-medium uppercase transition-colors ${
              showTimePopover
                ? "border-accent bg-accent/10 text-accent"
                : "border-foreground/20 bg-foreground/5 text-foreground/60"
            }`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {currentTimeLabel}
          </button>

          {/* Category filter button */}
          <button
            onClick={() => {
              setShowCategoryPopover(!showCategoryPopover);
              setShowTimePopover(false);
              setShowSortHelp(false);
            }}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-medium uppercase transition-colors ${
              showCategoryPopover
                ? "border-accent bg-accent/10 text-accent"
                : activeCount < 4
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-foreground/20 bg-foreground/5 text-foreground/60"
            }`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            {activeCount < 4 ? `${activeCount}/4` : "All"}
          </button>

          {/* Hide Seen toggle - closed eye (purple) = hiding seen, open eye (grey) = showing all */}
          {onHideSeenChange && (
            <button
              onClick={() => onHideSeenChange(!hideSeen)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-medium uppercase transition-colors ${
                hideSeen
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
                  : "border-foreground/20 bg-foreground/5 text-foreground/40"
              }`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          )}
        </div>
      </div>

      {/* Time Range Popover */}
      {showTimePopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowTimePopover(false)} />
          <div className="absolute right-4 top-full z-50 mt-2 w-48 rounded-xl border border-foreground/10 bg-background/95 p-2 shadow-xl backdrop-blur-xl">
            <div className="mb-2 px-2 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/40">
              Time Range
            </div>
            <div className="grid grid-cols-3 gap-1">
              {availableTimeRanges.map((range, i) => (
                <button
                  key={range.label}
                  onClick={() => handleTimeSelect(i)}
                  className={`rounded-lg px-3 py-2 font-mono text-xs font-medium transition-colors ${
                    timeRangeIndex === i
                      ? "bg-accent text-white"
                      : "text-foreground/60 active:bg-foreground/10"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Category Popover */}
      {showCategoryPopover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowCategoryPopover(false)} />
          <div className="absolute right-4 top-full z-50 mt-2 rounded-xl border border-foreground/10 bg-background/95 p-3 shadow-xl backdrop-blur-xl">
            <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/40">
              Categories
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategories.has(cat);
                const count = categoryCounts[cat];

                return (
                  <button
                    key={cat}
                    onClick={() => handleCategoryToggle(cat)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[10px] font-medium uppercase transition-all ${
                      isActive
                        ? "bg-foreground/15 text-foreground"
                        : "bg-foreground/5 text-foreground/30"
                    }`}
                    style={{
                      borderColor: isActive ? CATEGORY_COLORS[cat] : "transparent",
                      borderWidth: "1px",
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
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
          </div>
        </>
      )}

      {/* Sort Popover */}
      {showSortHelp && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSortHelp(false)} />
          <div className="absolute left-4 top-full z-50 mt-2 w-64 rounded-xl border border-foreground/10 bg-background/95 shadow-xl backdrop-blur-xl">
            <div className="px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-wider text-foreground/40 border-b border-foreground/10">
              Sort By
            </div>
            <div className="custom-scrollbar max-h-64 overflow-y-auto p-2 space-y-1">
              {SORT_OPTIONS.map((option) => {
                const isActive = sortBy === option.value;

                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      onSortChange(option.value);
                      setShowSortHelp(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? "bg-accent/20 text-accent"
                        : "text-foreground/60 active:bg-foreground/10"
                    }`}
                  >
                    {"isPulsing" in option && option.isPulsing ? (
                      <span className="relative flex h-4 w-4 items-center justify-center">
                        {incomingCount > 0 ? (
                          <>
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-500 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" />
                          </>
                        ) : (
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-foreground/30" />
                        )}
                      </span>
                    ) : option.shortLabel.includes("🔥") ||
                      option.shortLabel.includes("☢️") ||
                      option.shortLabel.includes("💬") ? (
                      <span className="flex h-4 w-4 items-center justify-center text-sm">
                        {option.shortLabel.split(" ")[0]}
                      </span>
                    ) : null}
                    <div className="flex-1">
                      <div className="font-mono text-xs font-medium uppercase">{option.label}</div>
                      <div className="text-[10px] text-foreground/40">{option.tooltip}</div>
                    </div>
                    {isActive && (
                      <svg
                        className="h-4 w-4 text-accent"
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
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export type { SortOption } from "@/lib/constants";
