"use client";

import React from "react";

interface ClusterTooltipProps {
  x: number;
  y: number;
  eventCount: number;
  locationLabel: string;
}

/**
 * Simple tooltip shown on cluster hover (with delay).
 * Provides hint about right-click and shift+click interactions.
 */
export function ClusterTooltip({ x, y, eventCount, locationLabel }: ClusterTooltipProps) {
  // Position above the cursor
  const getPositionStyle = (): React.CSSProperties => {
    const tooltipWidth = 200;
    const tooltipHeight = 50;
    const offset = 12;

    let left = x - tooltipWidth / 2;
    let top = y - tooltipHeight - offset;

    if (typeof window !== "undefined") {
      // Keep within edges
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8;
      }
      if (left < 8) {
        left = 8;
      }
      // If would go above viewport, show below cursor
      if (top < 8) {
        top = y + offset;
      }
    }

    return { left, top };
  };

  return (
    <div
      className="pointer-events-none fixed z-[90] rounded-lg border border-foreground/20 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm"
      style={getPositionStyle()}
    >
      <div className="font-mono text-xs font-medium text-foreground">
        {eventCount} event{eventCount !== 1 ? "s" : ""} near {locationLabel}
      </div>
      <div className="mt-0.5 font-mono text-[10px] text-foreground/40">
        Right-click for options • Shift+click for details
      </div>
    </div>
  );
}
