/**
 * Entity modal - shows entity details and recent events
 */

"use client";

import { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { EntityType } from "@/types/entities";
import { useEntityEvents } from "@/hooks/useEntityEvents";
import { getEntityIcon, getCountryFlag } from "@/lib/entities";

interface EntityModalProps {
  entityId: string;
  entityName: string;
  entityType: EntityType;
  onClose: () => void;
}

export function EntityModal({ entityId, entityName, entityType, onClose }: EntityModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const { events, loading } = useEntityEvents({ entityId, limit: 10 });

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

  // Don't render on server (SSR safety)
  if (typeof document === "undefined") return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-modal-title"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Modal Card */}
      <motion.div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-lg border border-foreground/10 bg-slate-900 shadow-2xl outline-none"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground"
          aria-label="Close modal"
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

        {/* Header */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{icon}</span>
            <div className="flex-1 min-w-0">
              <h2 id="entity-modal-title" className="text-xl font-semibold text-foreground">
                {entityName}
              </h2>
              <p className="text-sm text-foreground/50 capitalize">
                {entityType.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-foreground/10" />

        {/* Recent events section */}
        <div className="p-4">
          <h3 className="text-xs font-medium text-foreground/40 uppercase tracking-wide mb-3">
            Recent Events
          </h3>

          {loading ? (
            <div className="py-8 text-center text-foreground/50 text-sm">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="py-8 text-center text-foreground/50 text-sm">No events found</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
              {events.map((event) => (
                <div
                  key={event.event_id}
                  className="p-3 rounded-lg bg-foreground/5 border border-foreground/5"
                >
                  <p className="text-sm font-medium text-foreground leading-snug">{event.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-foreground/40 capitalize">
                      {event.relation_type}
                    </span>
                    <span className="text-foreground/20">•</span>
                    <span className="text-xs text-foreground/40">
                      {formatTimeAgo(event.event_timestamp)}
                    </span>
                    <span className="text-foreground/20">•</span>
                    <span className="text-xs text-foreground/40 capitalize">{event.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
