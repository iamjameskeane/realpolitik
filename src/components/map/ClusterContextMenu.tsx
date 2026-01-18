"use client";

import React, { useEffect, useRef } from "react";

interface ClusterContextMenuProps {
  x: number;
  y: number;
  eventCount: number;
  onClose: () => void;
  onViewDetails: () => void;
  onZoom: () => void;
  onStartFlyover: () => void;
}

/**
 * Context menu for right-clicking on clusters.
 * Shows options: Cluster Details, Zoom, Start Flyover.
 */
export function ClusterContextMenu({
  x,
  y,
  eventCount,
  onClose,
  onViewDetails,
  onZoom,
  onStartFlyover,
}: ClusterContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Use capture phase to catch clicks before they bubble
    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Position the menu, ensuring it stays within viewport
  const getPositionStyle = (): React.CSSProperties => {
    const menuWidth = 180;
    const menuHeight = 140;
    const padding = 8;

    let left = x;
    let top = y;

    if (typeof window !== "undefined") {
      // Keep within right edge
      if (left + menuWidth > window.innerWidth - padding) {
        left = window.innerWidth - menuWidth - padding;
      }
      // Keep within bottom edge
      if (top + menuHeight > window.innerHeight - padding) {
        top = window.innerHeight - menuHeight - padding;
      }
      // Keep within left edge
      if (left < padding) {
        left = padding;
      }
      // Keep within top edge
      if (top < padding) {
        top = padding;
      }
    }

    return { left, top };
  };

  const menuItems = [
    {
      label: "Cluster Details",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 6h16M4 12h16M4 18h7"
          />
        </svg>
      ),
      onClick: () => {
        onViewDetails();
        onClose();
      },
    },
    {
      label: "Zoom In",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
          />
        </svg>
      ),
      onClick: () => {
        onZoom();
        onClose();
      },
    },
    {
      label: "Start Flyover",
      icon: (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      onClick: () => {
        onStartFlyover();
        onClose();
      },
    },
  ];

  return (
    <div
      ref={menuRef}
      className="glass-panel pointer-events-auto fixed z-[100] min-w-[180px] overflow-hidden p-1"
      style={getPositionStyle()}
    >
      {/* Header with event count */}
      <div className="border-b border-foreground/10 px-3 py-2">
        <span className="font-mono text-[10px] text-foreground/50">
          {eventCount} event{eventCount !== 1 ? "s" : ""} in cluster
        </span>
      </div>

      {/* Menu items */}
      <div className="py-1">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          >
            <span className="text-foreground/50">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
