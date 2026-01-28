/**
 * Entity badge component - clickable chip showing entity name and icon
 */

"use client";

import { EntityType } from "@/types/entities";
import { getEntityIcon, getCountryFlag } from "@/lib/entities";

interface EntityBadgeProps {
  name: string;
  type: EntityType;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export function EntityBadge({ name, type, onClick, className = "" }: EntityBadgeProps) {
  const icon =
    type === "country" ? getCountryFlag(name) || getEntityIcon(type) : getEntityIcon(type);

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 
        rounded-full text-xs font-medium
        bg-foreground/5 hover:bg-foreground/10 
        text-foreground/80 hover:text-foreground
        transition-colors cursor-pointer
        ${className}
      `}
      type="button"
    >
      <span>{icon}</span>
      <span className="truncate max-w-[120px]">{name}</span>
    </button>
  );
}
