/**
 * Reaction / Analyst Protocol Types
 *
 * Proper TypeScript types for the crowdsourced event rating system.
 */

/** The three reaction types users can vote for */
export type ReactionType = "critical" | "market" | "noise";

/** Consensus can be any reaction type or null if no consensus reached */
export type ConsensusType = ReactionType | null;

/** Raw vote counts from the API */
export interface ReactionCounts {
  critical: number;
  market: number;
  noise: number;
  total: number;
}

/** Enriched reaction data with derived fields */
export interface EnrichedReactionData extends ReactionCounts {
  /** Dominant type if threshold met, null otherwise */
  consensus: ConsensusType;
  /** Percentage of votes for the consensus type (0-100) */
  consensusPct: number;
  /** True if weighted vote score >= HOT_WEIGHTED_THRESHOLD (critical votes count more) */
  isHot: boolean;
  /** Original severity adjusted by critical consensus */
  adjustedSeverity: number;
}

/** Configuration for each reaction type's UI */
export interface ReactionConfig {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  activeColor: string;
  barColor: string;
}

/** All reaction types in display order */
export const REACTION_TYPES: ReactionType[] = ["critical", "market", "noise"];

/** UI configuration for each reaction type */
export const REACTION_CONFIG: Record<ReactionType, ReactionConfig> = {
  critical: {
    label: "CRITICAL",
    emoji: "⚠️",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    activeColor: "bg-red-500",
    barColor: "bg-red-500",
  },
  market: {
    label: "MARKET",
    emoji: "📉",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    activeColor: "bg-amber-500",
    barColor: "bg-amber-500",
  },
  noise: {
    label: "NOISE",
    emoji: "🧊",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    activeColor: "bg-blue-500",
    barColor: "bg-blue-500",
  },
};
