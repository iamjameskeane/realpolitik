/**
 * Entity modal - shows entity details and recent events
 * Styled to match the EventsSidebar event list pattern
 */

"use client";

import { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { EntityType } from "@/types/entities";
import { useEntityEvents } from "@/hooks/useEntityEvents";
import { getEntityIcon, getCountryFlag } from "@/lib/entities";

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
}

export function EntityModal({ entityId, entityName, entityType, onClose }: EntityModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const { events, loading } = useEntityEvents({ entityId, limit: 20 });

  const icon =
    entityType === "country"
      ? getCountryFlag(entityName) || getEntityIcon(entityType)
      : getEntityIcon(entityType);

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

  // Format relative time
  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Don't render on server (SSR safety)
  if (typeof document === "undefined") return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-modal-title"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Modal Card - responsive sizing */}
      <motion.div
        ref={modalRef}
        tabIndex={-1}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-foreground/10 bg-slate-900/95 shadow-2xl outline-none backdrop-blur-md"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-foreground/10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{icon}</span>
              <div>
                <h2
                  id="entity-modal-title"
                  className="text-2xl font-semibold tracking-tight text-foreground"
                >
                  {entityName}
                </h2>
                <p className="mt-0.5 font-mono text-xs uppercase tracking-wider text-foreground/50">
                  {entityType.replace("_", " ")}
                </p>
              </div>
            </div>
            {/* Close Button */}
            <button
              onClick={onClose}
              className="rounded-full p-2 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
              aria-label="Close modal"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex items-center gap-4">
            <div className="rounded-lg bg-foreground/5 px-3 py-2">
              <p className="font-mono text-2xl font-bold text-foreground">{events.length}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
                Recent Events
              </p>
            </div>
          </div>
        </div>

        {/* Events list - scrollable, matching sidebar style */}
        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-foreground/20 border-t-accent" />
                <p className="font-mono text-xs text-foreground/40">Loading events...</p>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <p className="text-4xl">📭</p>
                <p className="mt-2 font-mono text-sm text-foreground/50">No events found</p>
                <p className="mt-1 font-mono text-xs text-foreground/30">
                  This entity hasn&apos;t appeared in recent news
                </p>
              </div>
            </div>
          ) : (
            <div>
              {events.map((event) => {
                const categoryColor = CATEGORY_COLORS[event.category] || "#888";

                return (
                  <div
                    key={event.event_id}
                    className="border-b border-foreground/5 px-5 py-4 transition-colors hover:bg-foreground/5"
                  >
                    {/* Category + Severity row */}
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: categoryColor }}
                      />
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
                    <h3 className="mt-2 text-sm font-medium leading-snug text-foreground/90">
                      {event.title}
                    </h3>

                    {/* Time */}
                    <div className="mt-2 font-mono text-[10px] text-foreground/40">
                      {formatTimeAgo(event.event_timestamp)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-foreground/10 px-5 py-3">
          <p className="text-center font-mono text-[10px] text-foreground/30">
            Showing events involving {entityName}
          </p>
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
