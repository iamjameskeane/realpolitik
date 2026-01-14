"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactionType, REACTION_CONFIG } from "@/types/reactions";

interface ButtonProps {
  type: ReactionType;
  count: number;
  isActive: boolean;
  isLoading: boolean;
  isFetching?: boolean;
  onClick: () => void;
}

/**
 * AnimatedCount - Smoothly animates number changes with a scale/fade effect
 */
export function AnimatedCount({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * CountSkeleton - Pulsing placeholder for loading counts
 */
function CountSkeleton({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block h-3 w-3 animate-pulse rounded bg-foreground/20 ${className}`} />
  );
}

/**
 * PuckButton - Small Discord-style reaction button
 *
 * Compact button for inline voting with tooltip on hover.
 */
export function PuckButton({
  type,
  count,
  isActive,
  isLoading,
  isFetching = false,
  onClick,
}: ButtonProps) {
  const config = REACTION_CONFIG[type];

  return (
    <div className="group relative">
      <button
        onClick={onClick}
        disabled={isLoading || isFetching}
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs transition-all active:scale-95 ${
          isActive
            ? `${config.activeColor} text-white shadow-md ring-2 ring-white/20`
            : `${config.bgColor} ${config.color} hover:brightness-125 border border-foreground/10`
        } ${isLoading || isFetching ? "opacity-50" : ""}`}
      >
        <span className="text-sm leading-none">{config.emoji}</span>
        {isFetching ? (
          <CountSkeleton className="h-2.5 w-2.5" />
        ) : (
          <AnimatedCount value={count} className="font-mono text-[11px] font-medium leading-none" />
        )}
      </button>
      {/* Custom tooltip */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
        <div
          className={`whitespace-nowrap rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${config.bgColor} ${config.color}`}
        >
          {config.label}
        </div>
        {/* Tooltip arrow */}
        <div
          className={`absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent ${
            type === "critical"
              ? "border-t-red-500/20"
              : type === "market"
                ? "border-t-amber-500/20"
                : "border-t-blue-500/20"
          }`}
        />
      </div>
    </div>
  );
}

/**
 * VoteButton - Full-size vote button for detailed view
 *
 * Larger button with label and count for the full voting interface.
 */
export function VoteButton({
  type,
  count,
  isActive,
  isLoading,
  isFetching = false,
  onClick,
}: ButtonProps) {
  const config = REACTION_CONFIG[type];

  return (
    <button
      onClick={onClick}
      disabled={isLoading || isFetching}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 transition-all ${
        isActive
          ? `${config.activeColor} border-transparent text-white shadow-lg ring-2 ring-white/20`
          : `border-foreground/15 ${config.bgColor} ${config.color} hover:border-foreground/30 hover:brightness-110`
      } ${isLoading || isFetching ? "opacity-50" : ""}`}
    >
      <span className="text-2xl drop-shadow-md">{config.emoji}</span>
      <span className="text-[10px] font-bold tracking-wider">{config.label}</span>
      {isFetching ? (
        <CountSkeleton className="h-4 w-4" />
      ) : (
        <AnimatedCount value={count} className="font-mono text-sm font-semibold" />
      )}
    </button>
  );
}
