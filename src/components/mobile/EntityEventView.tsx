"use client";

import { useCallback, useRef, useEffect } from "react";
import { motion, useAnimation, PanInfo } from "framer-motion";
import { EntityType, EntityEvent } from "@/types/entities";
import { getEntityIcon } from "@/lib/entities";
import { CountryFlag } from "../entities/CountryFlag";

// Category colors matching the app's theme
const CATEGORY_COLORS: Record<string, string> = {
  MILITARY: "#ef4444",
  DIPLOMACY: "#3b82f6",
  ECONOMY: "#22c55e",
  UNREST: "#f59e0b",
};

interface EntityEventViewProps {
  entity: {
    entityId: string;
    entityName: string;
    entityType: EntityType;
  };
  events: EntityEvent[];
  currentIndex: number;
  onNext?: () => void;
  onPrevious?: () => void;
  onEventSelect?: (event: EntityEvent) => void;
}

/**
 * Entity event view for mobile - shows entity events as swipeable cards
 * Simplified view showing event summaries before fetching full event
 */
export function EntityEventView({
  entity,
  events,
  currentIndex,
  onNext,
  onPrevious,
  onEventSelect,
}: EntityEventViewProps) {
  const controls = useAnimation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const event = events[currentIndex];

  // Reset scroll to top when event changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  const handleDragEnd = useCallback(
    async (_: MouseEvent | globalThis.TouchEvent | PointerEvent, info: PanInfo) => {
      const threshold = 50;
      const velocity = info.velocity.x;
      const offset = info.offset.x;

      if (offset < -threshold || velocity < -500) {
        // Swiped left -> next event
        if (onNext && currentIndex < events.length - 1) {
          await controls.start({ x: -100, opacity: 0, transition: { duration: 0.15 } });
          onNext();
          controls.set({ x: 100, opacity: 0 });
          await controls.start({ x: 0, opacity: 1, transition: { duration: 0.15 } });
        } else {
          controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
        }
      } else if (offset > threshold || velocity > 500) {
        // Swiped right -> previous event
        if (onPrevious && currentIndex > 0) {
          await controls.start({ x: 100, opacity: 0, transition: { duration: 0.15 } });
          onPrevious();
          controls.set({ x: -100, opacity: 0 });
          await controls.start({ x: 0, opacity: 1, transition: { duration: 0.15 } });
        } else {
          controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
        }
      } else {
        // Snap back
        controls.start({ x: 0, transition: { type: "spring", stiffness: 500, damping: 30 } });
      }
    },
    [controls, onNext, onPrevious, currentIndex, events.length]
  );

  if (!event) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="font-mono text-sm text-foreground/40">No events found</p>
      </div>
    );
  }

  const categoryColor = CATEGORY_COLORS[event.category] || "#888";

  return (
    <motion.div
      className="flex h-full flex-col px-4"
      animate={controls}
      drag="x"
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      style={{ touchAction: "pan-y" }}
    >
      {/* Entity header */}
      <div className="mb-3 flex shrink-0 items-center gap-3 border-b border-foreground/10 pb-3">
        {entity.entityType === "country" ? (
          <CountryFlag countryName={entity.entityName} size={32} />
        ) : (
          <span className="text-2xl">{getEntityIcon(entity.entityType)}</span>
        )}
        <div>
          <h3 className="text-sm font-semibold text-foreground">{entity.entityName}</h3>
          <p className="font-mono text-xs capitalize text-foreground/50">
            {entity.entityType.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mb-3 flex shrink-0 items-center justify-center gap-1.5">
        {events.map((_, i) => (
          <div
            key={i}
            className={`h-1 w-6 rounded-full transition-colors ${
              i === currentIndex ? "bg-accent" : "bg-foreground/20"
            }`}
          />
        ))}
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="custom-scrollbar flex-1 overflow-y-auto pb-4">
        {/* Category and severity */}
        <div className="mb-3 flex items-center gap-2">
          <span className="relative h-2.5 w-2.5">
            <span
              className="absolute inset-0 animate-pulse rounded-full opacity-50"
              style={{ backgroundColor: categoryColor }}
            />
            <span
              className="absolute inset-0 rounded-full"
              style={{ backgroundColor: categoryColor }}
            />
          </span>
          <span className="font-mono text-xs font-semibold" style={{ color: categoryColor }}>
            {event.category}
          </span>
          <span className="font-mono text-xs text-foreground/40">SEV {event.severity}</span>
          <span className="ml-auto rounded bg-foreground/10 px-1.5 py-0.5 font-mono text-[9px] capitalize text-foreground/50">
            {event.relation_type}
          </span>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-lg font-semibold leading-tight text-foreground">{event.title}</h2>

        {/* Timestamp */}
        <div className="mb-3 font-mono text-xs text-foreground/50">
          {new Date(event.event_timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>

        {/* Summary */}
        <p className="text-sm leading-relaxed text-foreground/70">{event.summary}</p>

        {/* View full event button */}
        {onEventSelect && (
          <button
            onClick={() => onEventSelect(event)}
            className="mt-4 w-full rounded-lg bg-accent/20 px-4 py-3 font-mono text-sm font-medium text-accent transition-all active:scale-[0.98]"
          >
            View Full Event
          </button>
        )}
      </div>
    </motion.div>
  );
}
