"use client";

import { memo, useCallback } from "react";
import { useReactions } from "@/hooks/useReactions";
import { ReactionType, REACTION_TYPES } from "@/types/reactions";
import { ThreatBar, ThreatBarSkeleton } from "./ThreatBar";
import { InfoPopover } from "./InfoPopover";
import { PuckButton, VoteButton } from "./VoteButtons";
import { useAuth } from "@/contexts/AuthContext";

interface ReactionGridProps {
  eventId: string;
  variant?: "full" | "compact" | "pucks";
  className?: string;
}

/**
 * ReactionPucks - Small Discord-style reaction buttons
 *
 * Use this at the top of cards for quick voting.
 */
export const ReactionPucks = memo(function ReactionPucks({
  eventId,
  className = "",
}: {
  eventId: string;
  className?: string;
}) {
  const { user } = useAuth();
  const { counts, userVote, isFetching, isLoading, vote, unvote } = useReactions({ eventId });

  const handleVote = useCallback(
    (type: ReactionType) => {
      if (!user) return; // Safety check
      if (userVote === type) {
        unvote();
      } else {
        vote(type);
      }
    },
    [user, userVote, vote, unvote]
  );

  // Hide reactions entirely if not signed in
  if (!user) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {REACTION_TYPES.map((type) => (
        <PuckButton
          key={type}
          type={type}
          count={counts[type]}
          isActive={userVote === type}
          isLoading={isLoading}
          isFetching={isFetching}
          onClick={() => handleVote(type)}
        />
      ))}
      <InfoPopover />
    </div>
  );
});

/**
 * ReactionResults - Vote distribution bar chart
 *
 * Only renders if there are votes (or shows skeleton while loading).
 */
export const ReactionResults = memo(function ReactionResults({
  eventId,
  className = "",
}: {
  eventId: string;
  className?: string;
}) {
  const { counts, isFetching } = useReactions({ eventId });

  // Show skeleton while fetching
  if (isFetching) {
    return (
      <div className={className}>
        <ThreatBarSkeleton />
      </div>
    );
  }

  if (counts.total === 0) return null;

  return (
    <div className={className}>
      <ThreatBar counts={counts} />
    </div>
  );
});

/**
 * ReactionGrid - Full Analyst Protocol voting interface
 *
 * Displays three voting options (CRITICAL, MARKET, NOISE) with
 * a threat bar showing the vote distribution.
 *
 * Variants:
 * - "pucks": Small inline buttons (same as ReactionPucks)
 * - "compact": Pucks with inline bar below
 * - "full": Large buttons with detailed chart
 */
export const ReactionGrid = memo(function ReactionGrid({
  eventId,
  variant = "full",
  className = "",
}: ReactionGridProps) {
  const { user } = useAuth();
  const { counts, userVote, isFetching, isLoading, vote, unvote } = useReactions({ eventId });

  const handleVote = useCallback(
    (type: ReactionType) => {
      if (!user) return; // Safety check
      if (userVote === type) {
        unvote();
      } else {
        vote(type);
      }
    },
    [user, userVote, vote, unvote]
  );

  // Hide reactions entirely if not signed in
  if (!user) {
    return null;
  }

  // Pucks variant - just the small buttons
  if (variant === "pucks") {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {REACTION_TYPES.map((type) => (
          <PuckButton
            key={type}
            type={type}
            count={counts[type]}
            isActive={userVote === type}
            isLoading={isLoading}
            isFetching={isFetching}
            onClick={() => handleVote(type)}
          />
        ))}
        <InfoPopover />
      </div>
    );
  }

  // Compact variant - pucks with inline bar
  if (variant === "compact") {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        <div className="flex items-center gap-1.5">
          {REACTION_TYPES.map((type) => (
            <PuckButton
              key={type}
              type={type}
              count={counts[type]}
              isActive={userVote === type}
              isLoading={isLoading}
              isFetching={isFetching}
              onClick={() => handleVote(type)}
            />
          ))}
          <InfoPopover />
        </div>
        {isFetching ? (
          <ThreatBarSkeleton height="sm" />
        ) : (
          counts.total > 0 && <ThreatBar counts={counts} showLegend={false} height="sm" />
        )}
      </div>
    );
  }

  // Full variant - big buttons with chart
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex gap-2">
        {REACTION_TYPES.map((type) => (
          <VoteButton
            key={type}
            type={type}
            count={counts[type]}
            isActive={userVote === type}
            isLoading={isLoading}
            isFetching={isFetching}
            onClick={() => handleVote(type)}
          />
        ))}
      </div>
      {isFetching ? <ThreatBarSkeleton /> : counts.total > 0 && <ThreatBar counts={counts} />}
    </div>
  );
});
