"use client";

import { GeoEvent } from "@/types/events";
import { EventEntity } from "@/types/entities";
import { EventList } from "./EventList";
import { getEntityIcon, getCountryCode } from "@/lib/entities";
import { CountryFlag } from "../entities";
import { EventVisualState } from "@/hooks/useEventStates";

interface EntityEventListProps {
  entity: EventEntity;
  events: GeoEvent[];
  onEventSelect: (event: GeoEvent, index: number) => void;
  onBack: () => void;
  eventStateMap?: Map<string, EventVisualState>;
}

/**
 * EntityEventList - Shows a feed of events related to an entity
 *
 * Similar to the main event feed, but filtered to a specific entity.
 * When user taps an event, it opens EntityBrowser with swipeable cards.
 */
export function EntityEventList({
  entity,
  events,
  onEventSelect,
  onBack,
  eventStateMap,
}: EntityEventListProps) {
  const countryCode = entity.node_type === "country" ? getCountryCode(entity.name) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Entity header */}
      <div className="shrink-0 border-b border-foreground/10 px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Entity icon/flag */}
          <div className="flex h-6 w-6 items-center justify-center">
            {countryCode ? (
              <CountryFlag countryName={entity.name} size={24} />
            ) : (
              <span className="text-lg">{getEntityIcon(entity.node_type)}</span>
            )}
          </div>

          <div className="flex flex-col">
            <h3 className="text-sm font-medium text-foreground">{entity.name}</h3>
            <p className="font-mono text-[10px] uppercase tracking-wide text-foreground/40">
              {entity.node_type.replace("_", " ")}
            </p>
          </div>

          <div className="ml-auto text-right">
            <p className="font-mono text-xs text-foreground/40">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Event list - reuse existing EventList component */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {events.length > 0 ? (
          <EventList
            events={events}
            onEventSelect={(event) => {
              const index = events.findIndex((e) => e.id === event.id);
              onEventSelect(event, index);
            }}
            eventStateMap={eventStateMap}
          />
        ) : (
          <div className="flex h-64 flex-col items-center justify-center px-6 text-center">
            <p className="mb-2 text-sm font-medium text-foreground/70">No events found</p>
            <p className="text-xs text-foreground/40">
              No events are associated with {entity.name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
