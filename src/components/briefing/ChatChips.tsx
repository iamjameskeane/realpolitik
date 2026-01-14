"use client";

import { memo } from "react";

interface ChatChipsProps {
  chips: string[];
  onChipClick: (chip: string) => void;
  disabled?: boolean;
}

/**
 * Row of quick action chips for common questions.
 * Chips are styled as pill buttons that wrap on mobile.
 */
export const ChatChips = memo(function ChatChips({ chips, onChipClick, disabled }: ChatChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onChipClick(chip)}
          disabled={disabled}
          className={`rounded-full border border-foreground/20 bg-foreground/5 px-3 py-1.5 font-mono text-xs transition-all ${
            disabled
              ? "cursor-not-allowed opacity-50"
              : "hover:border-accent hover:bg-accent/10 hover:text-accent active:scale-95"
          }`}
        >
          {chip}
        </button>
      ))}
    </div>
  );
});
