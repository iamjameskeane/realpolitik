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
}

export function EntityList({ entities, maxVisible = 5, className = "" }: EntityListProps) {
  const [selectedEntity, setSelectedEntity] = useState<EventEntity | null>(null);

  if (entities.length === 0) return null;

  const visibleEntities = entities.slice(0, maxVisible);
  const hiddenCount = entities.length - maxVisible;

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {visibleEntities.map((entity) => (
        <EntityBadge
          key={entity.entity_id}
          name={entity.name}
          type={entity.node_type}
          onClick={() => setSelectedEntity(entity)}
        />
      ))}

      {hiddenCount > 0 && (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs text-foreground/50">
          +{hiddenCount} more
        </span>
      )}

      {selectedEntity && (
        <EntityModal
          entityId={selectedEntity.entity_id}
          entityName={selectedEntity.name}
          entityType={selectedEntity.node_type}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </div>
  );
}
