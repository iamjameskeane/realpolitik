"use client";

import { useCallback } from "react";
import { GeoEvent } from "@/types/events";
import { EventEntity } from "@/types/entities";
import { EventCard } from "./EventCard";

interface EntityBrowserProps {
  entity: EventEntity;
  events: GeoEvent[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onEventClick: (event: GeoEvent) => void;
  onEntityClick: (entity: EventEntity) => void;
  onRequestBriefing: (event: GeoEvent) => void;
  onBack: () => void;
}

/**
 * EntityBrowser - Browse events related to an entity
 *
 * Reuses EventCard for consistency and proper UX.
 * Supports nested entity navigation (clicking entities within events).
 */
export function EntityBrowser({
  entity,
  events,
  currentIndex,
  onNavigate,
  onEventClick,
  onEntityClick,
  onRequestBriefing,
  onBack,
}: EntityBrowserProps) {
  const currentEvent = events[currentIndex];

  // Swipe handlers
  const handleNext = useCallback(() => {
    if (currentIndex < events.length - 1) {
      onNavigate(currentIndex + 1);
    }
  }, [currentIndex, events.length, onNavigate]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      onNavigate(currentIndex - 1);
    }
  }, [currentIndex, onNavigate]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden pt-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Reuse EventCard with entity navigation - it handles all progress indicators */}
      {currentEvent && (
        <EventCard
          event={currentEvent}
          currentIndex={currentIndex}
          totalCount={events.length}
          stackedEvents={events}
          stackIndex={currentIndex}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onRequestBriefing={() => onRequestBriefing(currentEvent)}
          onEntityClick={onEntityClick}
        />
      )}
    </div>
  );
}
