"use client";

import { EventCategory, CATEGORY_COLORS } from "@/types/events";

const CATEGORIES: EventCategory[] = ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"];

interface CategoryChipsProps {
  activeCategories: Set<EventCategory>;
  onToggleCategory: (category: EventCategory) => void;
  counts: Record<EventCategory, number>;
}

/**
 * Horizontal scrollable category filter chips for mobile.
 */
export function CategoryChips({ activeCategories, onToggleCategory, counts }: CategoryChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto px-4 pb-2 pt-1 scrollbar-hide">
      {CATEGORIES.map((cat) => {
        const isActive = activeCategories.has(cat);
        const count = counts[cat];

        return (
          <button
            key={cat}
            onClick={() => onToggleCategory(cat)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] font-medium uppercase transition-all ${
              isActive ? "bg-foreground/15 text-foreground" : "bg-foreground/5 text-foreground/40"
            }`}
            style={{
              borderColor: isActive ? CATEGORY_COLORS[cat] : "transparent",
              borderWidth: "1px",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: isActive ? CATEGORY_COLORS[cat] : "currentColor",
              }}
            />
            {cat}
            <span className="opacity-60">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
