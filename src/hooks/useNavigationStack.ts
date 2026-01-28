"use client";

/**
 * useNavigationStack - Stack-based navigation for mobile
 *
 * Replaces the phase-based system with a unified navigation stack that supports
 * arbitrary depth traversal between events, entities, and briefings.
 */

import { useState, useCallback, useMemo } from "react";
import { GeoEvent } from "@/types/events";
import { EventEntity } from "@/types/entities";

export type NavigationFrame =
  | { type: "scanner" }
  | { type: "event"; event: GeoEvent; stackEvents: GeoEvent[]; stackIndex: number }
  | { type: "entity"; entity: EventEntity; events: GeoEvent[]; index: number }
  | { type: "briefing"; event: GeoEvent };

export interface UseNavigationStackReturn {
  // Current state
  stack: NavigationFrame[];
  currentFrame: NavigationFrame;
  canGoBack: boolean;

  // Navigation actions
  pushEvent: (event: GeoEvent, stackEvents?: GeoEvent[]) => void;
  pushEntity: (entity: EventEntity, events: GeoEvent[]) => void;
  pushBriefing: (event: GeoEvent) => void;
  goBack: () => void;
  goToScanner: () => void;

  // Frame-specific actions
  navigateWithinFrame: (index: number) => void; // For swiping within events/entities
  updateCurrentEvent: (event: GeoEvent) => void; // When loading full event data
}

export function useNavigationStack(): UseNavigationStackReturn {
  const [stack, setStack] = useState<NavigationFrame[]>([{ type: "scanner" }]);

  const currentFrame = useMemo(() => stack[stack.length - 1], [stack]);
  const canGoBack = stack.length > 1;

  const pushEvent = useCallback((event: GeoEvent, stackEvents?: GeoEvent[]) => {
    setStack((prev) => [
      ...prev,
      {
        type: "event",
        event,
        stackEvents: stackEvents || [event],
        stackIndex: 0,
      },
    ]);
  }, []);

  const pushEntity = useCallback((entity: EventEntity, events: GeoEvent[]) => {
    setStack((prev) => [
      ...prev,
      {
        type: "entity",
        entity,
        events,
        index: 0,
      },
    ]);
  }, []);

  const pushBriefing = useCallback((event: GeoEvent) => {
    setStack((prev) => [...prev, { type: "briefing", event }]);
  }, []);

  const goBack = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const goToScanner = useCallback(() => {
    setStack([{ type: "scanner" }]);
  }, []);

  const navigateWithinFrame = useCallback((index: number) => {
    setStack((prev) => {
      const newStack = [...prev];
      const frame = newStack[newStack.length - 1];

      if (frame.type === "event" && frame.stackEvents) {
        const newEvent = frame.stackEvents[index];
        if (newEvent) {
          newStack[newStack.length - 1] = { ...frame, event: newEvent, stackIndex: index };
        }
      } else if (frame.type === "entity") {
        newStack[newStack.length - 1] = { ...frame, index };
      }

      return newStack;
    });
  }, []);

  const updateCurrentEvent = useCallback((event: GeoEvent) => {
    setStack((prev) => {
      const newStack = [...prev];
      const frame = newStack[newStack.length - 1];
      if (frame.type === "event") {
        newStack[newStack.length - 1] = { ...frame, event };
      }
      return newStack;
    });
  }, []);

  return {
    stack,
    currentFrame,
    canGoBack,
    pushEvent,
    pushEntity,
    pushBriefing,
    goBack,
    goToScanner,
    navigateWithinFrame,
    updateCurrentEvent,
  };
}
