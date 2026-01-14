"use client";

import { memo } from "react";
import { useEventReaction, EnrichedReactionData } from "@/hooks/useBatchReactions";

const CONSENSUS_CONFIG = {
  critical: {
    label: "CRITICAL",
    emoji: "⚠️",
    bgColor: "bg-red-500/20",
    textColor: "text-red-400",
    borderColor: "border-red-500/30",
  },
  market: {
    label: "MARKET MOVER",
    emoji: "📉",
    bgColor: "bg-amber-500/20",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/30",
  },
  noise: {
    label: "LIKELY NOISE",
    emoji: "🧊",
    bgColor: "bg-blue-500/20",
    textColor: "text-blue-400",
    borderColor: "border-blue-500/30",
  },
};

interface ConsensusBadgeProps {
  eventId: string;
  className?: string;
  showVoteCount?: boolean;
}

/**
 * Shows "Analysts say: CRITICAL" badge when there's consensus
 */
export const ConsensusBadge = memo(function ConsensusBadge({
  eventId,
  className = "",
  showVoteCount = true,
}: ConsensusBadgeProps) {
  const { data } = useEventReaction(eventId);

  if (!data?.consensus) return null;

  const config = CONSENSUS_CONFIG[data.consensus];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${config.bgColor} ${config.borderColor} ${className}`}
    >
      <span className="text-xs">{config.emoji}</span>
      <span className={`text-[10px] font-bold uppercase tracking-wider ${config.textColor}`}>
        Analysts say: {config.label}
      </span>
      {showVoteCount && <span className="text-[9px] text-foreground/40">({data.total} votes)</span>}
    </div>
  );
});

/**
 * "Hot" badge for high engagement events
 */
export const HotBadge = memo(function HotBadge({
  eventId,
  className = "",
}: {
  eventId: string;
  className?: string;
}) {
  const { data } = useEventReaction(eventId);

  if (!data?.isHot) return null;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 ${className}`}
    >
      <span className="text-xs">🔥</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
        Trending
      </span>
    </div>
  );
});

/**
 * Combined badges component for convenience
 */
export const EventBadges = memo(function EventBadges({
  eventId,
  className = "",
}: {
  eventId: string;
  className?: string;
}) {
  const { data } = useEventReaction(eventId);

  if (!data) return null;

  // Show Hot badge OR Consensus badge (not both, to avoid clutter)
  if (data.isHot && !data.consensus) {
    return <HotBadge eventId={eventId} className={className} />;
  }

  if (data.consensus) {
    return <ConsensusBadge eventId={eventId} className={className} />;
  }

  return null;
});

/**
 * Hook to check if an event should be faded (noise consensus)
 */
export function useShouldFade(data: EnrichedReactionData | null): boolean {
  if (!data) return false;
  return data.consensus === "noise";
}
