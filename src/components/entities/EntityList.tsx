/**
 * Entity list component - displays entity badges with popover on click
 */

"use client";

import { useState } from "react";
import { EventEntity } from "@/types/entities";
import { EntityBadge } from "./EntityBadge";
import { EntityModal } from "./EntityModal";

interface EntityListProps {
  entities: EventEntity[];
  maxVisible?: number;
  className?: string;
  /** Callback when clicking an event in the entity modal */
  onEventClick?: (eventId: string) => void;
  /** Callback when clicking an entity badge (for mobile navigation) */
  onEntityClick?: (entity: EventEntity) => void;
}

export function EntityList({
  entities,
  maxVisible = 5,
  className = "",
  onEventClick,
  onEntityClick,
}: EntityListProps) {
  const [selectedEntity, setSelectedEntity] = useState<EventEntity | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  if (entities.length === 0) return null;

  const hiddenCount = entities.length - maxVisible;
  const visibleEntities = isExpanded ? entities : entities.slice(0, maxVisible);

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {visibleEntities.map((entity) => (
        <EntityBadge
          key={entity.entity_id}
          name={entity.name}
          type={entity.node_type}
          onClick={() => {
            // If mobile callback provided, use it instead of modal
            if (onEntityClick) {
              onEntityClick(entity);
            } else {
              setSelectedEntity(entity);
            }
          }}
        />
      ))}

      {hiddenCount > 0 && !isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-foreground/50 hover:text-foreground/80 hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          +{hiddenCount} more
        </button>
      )}

      {isExpanded && hiddenCount > 0 && (
        <button
          onClick={() => setIsExpanded(false)}
          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-foreground/50 hover:text-foreground/80 hover:bg-slate-800/50 transition-colors cursor-pointer"
        >
          show less
        </button>
      )}

      {/* Only render modal if not using mobile callback */}
      {!onEntityClick && selectedEntity && (
        <EntityModal
          entityId={selectedEntity.entity_id}
          entityName={selectedEntity.name}
          entityType={selectedEntity.node_type}
          onClose={() => setSelectedEntity(null)}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}
