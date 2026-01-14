"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactionCounts } from "@/types/reactions";
import { AnimatedCount } from "./VoteButtons";

interface ThreatBarProps {
  counts: ReactionCounts;
  showLegend?: boolean;
  height?: "sm" | "md";
}

/**
 * ThreatBarSkeleton - Loading placeholder for ThreatBar
 */
export function ThreatBarSkeleton({
  showLegend = true,
  height = "md",
}: {
  showLegend?: boolean;
  height?: "sm" | "md";
}) {
  const barHeight = height === "sm" ? "h-1" : "h-2";

  return (
    <div className="flex flex-col gap-2">
      {showLegend && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
            Analyst Consensus
          </span>
          <span className="h-2.5 w-12 animate-pulse rounded bg-foreground/10" />
        </div>
      )}
      <div
        className={`${barHeight} w-full animate-pulse overflow-hidden rounded-full bg-foreground/10`}
      />
      {showLegend && (
        <div className="flex items-center justify-center gap-3">
          <span className="h-2.5 w-16 animate-pulse rounded bg-foreground/10" />
          <span className="h-2.5 w-14 animate-pulse rounded bg-foreground/10" />
          <span className="h-2.5 w-12 animate-pulse rounded bg-foreground/10" />
        </div>
      )}
    </div>
  );
}

/**
 * ThreatBar - Horizontal stacked bar showing vote distribution
 *
 * Visualizes the distribution of Critical/Market/Noise votes
 * with optional legend showing vote counts.
 */
export function ThreatBar({ counts, showLegend = true, height = "md" }: ThreatBarProps) {
  const { critical, market, noise, total } = counts;

  if (total === 0) return null;

  const criticalPct = (critical / total) * 100;
  const marketPct = (market / total) * 100;
  const noisePct = (noise / total) * 100;

  const barHeight = height === "sm" ? "h-1" : "h-2";

  return (
    <div className="flex flex-col gap-2">
      {showLegend && (
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
            Analyst Consensus
          </span>
          <span className="font-mono text-[10px] text-foreground/40">
            <AnimatedCount value={total} /> vote{total !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Stacked bar */}
      <div className={`flex ${barHeight} w-full overflow-hidden rounded-full bg-foreground/5`}>
        <motion.div
          className="bg-red-500"
          initial={false}
          animate={{ width: `${criticalPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <motion.div
          className="bg-amber-500"
          initial={false}
          animate={{ width: `${marketPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <motion.div
          className="bg-blue-500"
          initial={false}
          animate={{ width: `${noisePct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-center gap-3 text-[10px]">
          <AnimatePresence mode="popLayout">
            {critical > 0 && (
              <motion.div
                key="critical"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1"
              >
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-foreground/50">
                  Critical <AnimatedCount value={critical} />
                </span>
              </motion.div>
            )}
            {market > 0 && (
              <motion.div
                key="market"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-foreground/50">
                  Market <AnimatedCount value={market} />
                </span>
              </motion.div>
            )}
            {noise > 0 && (
              <motion.div
                key="noise"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1"
              >
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-foreground/50">
                  Noise <AnimatedCount value={noise} />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
