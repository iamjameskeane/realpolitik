/**
 * Entity modal - shows entity details and recent events
 * Matches BriefingModal container style and EventsSidebar event list style
 */

"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { EntityType } from "@/types/entities";
import { useEntityEvents } from "@/hooks/useEntityEvents";
import { getEntityIcon } from "@/lib/entities";
import { CountryFlag } from "./CountryFlag";

// Category colors matching the app's theme
const CATEGORY_COLORS: Record<string, string> = {
  MILITARY: "#ef4444",
  DIPLOMACY: "#3b82f6",
  ECONOMY: "#22c55e",
  UNREST: "#f59e0b",
};

interface EntityModalProps {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  onClose: () => void;
  /** Callback when clicking an event to navigate to it */
  onEventClick?: (eventId: string) => void;
}

export function EntityModal({
  entityId,
  entityName,
  entityType,
  onClose,
  onEventClick,
}: EntityModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const { events, loading } = useEntityEvents({ entityId, limit: 20 });

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Focus trap and body scroll lock
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousActiveElement.current?.focus();
    };
  }, [handleKeyDown]);

  // Don't render on server (SSR safety)
  if (typeof document === "undefined") return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal - matches BriefingModal style */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative mx-4 flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-background/95 shadow-2xl outline-none backdrop-blur-xl"
      >
        {/* Header - matches BriefingModal pattern */}
        <div className="flex shrink-0 items-start justify-between border-b border-foreground/10 p-5">
          <div className="flex items-center gap-4">
            {entityType === "country" ? (
              <CountryFlag countryName={entityName} size={48} />
            ) : (
              <span className="text-4xl">{getEntityIcon(entityType)}</span>
            )}
            <div>
              <h2 className="text-lg font-semibold leading-snug text-foreground">{entityName}</h2>
              <div className="mt-1 flex items-center gap-2 text-xs text-foreground/50">
                <span className="capitalize">{entityType.replace("_", " ")}</span>
                <span>•</span>
                <span>{events.length} events</span>
              </div>
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

        {/* Events list - matches EventsSidebar exactly */}
        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-accent" />
                <p className="font-mono text-xs text-foreground/40">Loading events...</p>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="px-4 py-8 text-center font-mono text-xs text-foreground/30">
              No events found for this entity
            </div>
          ) : (
            events.map((event) => {
              const categoryColor = CATEGORY_COLORS[event.category] || "#888";

              return (
                <div key={event.event_id} className="border-b border-foreground/5">
                  {/* Event item - exact sidebar styling, clickable */}
                  <button
                    onClick={() => {
                      if (onEventClick) {
                        onEventClick(event.event_id);
                        onClose();
                      }
                    }}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-foreground/5 ${
                      onEventClick ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    {/* Category + Severity row */}
                    <div className="flex items-center gap-2">
                      <span className="relative h-2 w-2">
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: categoryColor }}
                        />
                      </span>
                      <span
                        className="font-mono text-[10px] font-medium uppercase"
                        style={{ color: categoryColor }}
                      >
                        {event.category}
                      </span>
                      <span className="font-mono text-[10px] text-foreground/30">
                        SEV {event.severity}
                      </span>
                      <span className="ml-auto rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[9px] capitalize text-foreground/50">
                        {event.relation_type}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-foreground/90">
                      {event.title}
                    </h3>

                    {/* Time */}
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-foreground/40">
                      <span>
                        {new Date(event.event_timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
