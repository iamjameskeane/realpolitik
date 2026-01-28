/**
 * Entity list component - displays entity badges with popover on click
 */

"use client";

import { useState } from "react";
import { EventEntity } from "@/types/entities";
import { EntityBadge } from "./EntityBadge";
import { EntityPopover } from "./EntityPopover";

interface EntityListProps {
  entities: EventEntity[];
  maxVisible?: number;
  className?: string;
  onEventClick?: (eventId: string) => void;
}

export function EntityList({
  entities,
  maxVisible = 5,
  className = "",
  onEventClick,
}: EntityListProps) {
  const [selectedEntity, setSelectedEntity] = useState<EventEntity | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null);

  if (entities.length === 0) return null;

  const visibleEntities = entities.slice(0, maxVisible);
  const hiddenCount = entities.length - maxVisible;

  const handleBadgeClick = (entity: EventEntity, event: React.MouseEvent) => {
    setSelectedEntity(entity);
    setPopoverAnchor(event.currentTarget as HTMLElement);
  };

  const handleClose = () => {
    setSelectedEntity(null);
    setPopoverAnchor(null);
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {visibleEntities.map((entity) => (
        <EntityBadge
          key={entity.entity_id}
          name={entity.name}
          type={entity.node_type}
          onClick={(e) => handleBadgeClick(entity, e)}
        />
      ))}

      {hiddenCount > 0 && (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-foreground/50">
          +{hiddenCount} more
        </span>
      )}

      {selectedEntity && popoverAnchor && (
        <EntityPopover
          entityId={selectedEntity.entity_id}
          entityName={selectedEntity.name}
          entityType={selectedEntity.node_type}
          anchorEl={popoverAnchor}
          onClose={handleClose}
          onEventClick={onEventClick}
        />
      )}
    </div>
  );
}
