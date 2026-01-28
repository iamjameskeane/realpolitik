/**
 * Entity popover - shows entity details and recent events
 */

"use client";

import { useRef, useEffect } from "react";
import { EntityType } from "@/types/entities";
import { useEntityEvents } from "@/hooks/useEntityEvents";
import { getEntityIcon, getCountryFlag } from "@/lib/entities";

interface EntityPopoverProps {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  anchorEl: HTMLElement;
  onClose: () => void;
  onEventClick?: (eventId: string) => void;
}

export function EntityPopover({
  entityId,
  entityName,
  entityType,
  anchorEl,
  onClose,
  onEventClick,
}: EntityPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { events, loading } = useEntityEvents({ entityId, limit: 3 });

  const icon =
    entityType === "country"
      ? getCountryFlag(entityName) || getEntityIcon(entityType)
      : getEntityIcon(entityType);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !anchorEl.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anchorEl, onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Position popover relative to anchor
  const anchorRect = anchorEl.getBoundingClientRect();

  // Calculate position (below anchor, left-aligned, but adjust if would go off-screen)
  // Estimate popover height (header + 3 events + padding)
  const estimatedHeight = 280;
  const spaceBelow = window.innerHeight - anchorRect.bottom - 8;
  const spaceAbove = anchorRect.top - 8;

  // Position above if not enough space below
  const top =
    spaceBelow >= estimatedHeight
      ? anchorRect.bottom + 8
      : spaceAbove >= estimatedHeight
        ? anchorRect.top - estimatedHeight - 8
        : 8; // Fallback to top of viewport

  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - 300);

  // Format time ago
  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 w-72 bg-background border border-foreground/10 rounded-lg shadow-xl"
      style={{ top, left }}
    >
      {/* Header */}
      <div className="p-4 border-b border-foreground/10">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{entityName}</h3>
            <p className="text-xs text-foreground/50 capitalize">{entityType.replace("_", " ")}</p>
          </div>
        </div>
      </div>

      {/* Recent events */}
      <div className="p-2 max-h-64 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-4 text-center text-foreground/50 text-sm">Loading...</div>
        ) : events.length === 0 ? (
          <div className="p-4 text-center text-foreground/50 text-sm">No recent events</div>
        ) : (
          <div className="space-y-1">
            {events.map((event) => (
              <button
                key={event.event_id}
                onClick={() => {
                  onEventClick?.(event.event_id);
                  onClose();
                }}
                className="w-full text-left p-2 rounded hover:bg-foreground/5 transition-colors"
                type="button"
              >
                <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
                <p className="text-xs text-foreground/50 mt-0.5">
                  {event.relation_type} • {formatTimeAgo(event.event_timestamp)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
