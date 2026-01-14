"use client";

import { useState, useRef, useEffect } from "react";
import { REACTION_CONFIG, REACTION_TYPES } from "@/types/reactions";

interface InfoPopoverProps {
  className?: string;
}

/**
 * InfoPopover - Help button explaining reaction types
 *
 * Shows a popover with descriptions of Critical, Market, and Noise ratings,
 * including how they influence the hot algorithm and event display.
 */
export function InfoPopover({ className = "" }: InfoPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const descriptions: Record<string, { short: string; effect: string }> = {
    critical: {
      short: "High-impact event requiring attention",
      effect: "Boosts ranking, adds pulsing indicator on map",
    },
    market: {
      short: "Significant financial or economic impact",
      effect: "Helps others identify market-moving events",
    },
    noise: {
      short: "Low signal, routine, or overhyped",
      effect: "Lowers ranking, fades event on map",
    },
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/5 text-[10px] font-bold text-foreground/40 transition-colors hover:bg-foreground/10 hover:text-foreground/60"
        aria-label="What do these mean?"
      >
        ?
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border border-foreground/10 bg-background p-3 shadow-xl"
        >
          {/* Arrow pointing up */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-foreground/10" />
          <div className="absolute bottom-full left-1/2 mt-px -translate-x-1/2 border-[5px] border-transparent border-b-background" />

          <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
            Analyst Protocol
          </div>

          {/* Reaction types */}
          <div className="flex flex-col gap-2.5">
            {REACTION_TYPES.map((type) => {
              const config = REACTION_CONFIG[type];
              const desc = descriptions[type];
              return (
                <div key={type} className="flex items-start gap-2">
                  <span className="mt-0.5 text-sm">{config.emoji}</span>
                  <div className="flex-1">
                    <div className={`text-xs font-semibold ${config.color}`}>
                      {config.label.charAt(0) + config.label.slice(1).toLowerCase()}
                    </div>
                    <div className="text-[10px] leading-tight text-foreground/60">{desc.short}</div>
                    <div className="mt-0.5 text-[9px] leading-tight text-foreground/40 italic">
                      → {desc.effect}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* How it works section */}
          <div className="mt-3 border-t border-foreground/10 pt-2.5">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
              How It Works
            </div>
            <ul className="space-y-1 text-[10px] leading-tight text-foreground/50">
              <li className="flex gap-1.5">
                <span className="text-foreground/30">•</span>
                <span>
                  When 60%+ of votes agree, a{" "}
                  <span className="font-medium text-foreground/70">consensus</span> forms
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-foreground/30">•</span>
                <span>
                  Consensus affects <span className="font-medium text-foreground/70">🔥 Hot</span>{" "}
                  sort ranking
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-foreground/30">•</span>
                <span>
                  5+ votes earns the{" "}
                  <span className="font-medium text-foreground/70">trending</span> badge
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-foreground/30">•</span>
                <span>Your vote is anonymous &amp; can be changed</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
