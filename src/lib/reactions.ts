/**
 * Reactions (Analyst Protocol)
 *
 * Three-way voting system: CRITICAL, MARKET, NOISE
 * Uses Supabase for storage with user fingerprint deduplication.
 */

import { getSupabaseClient } from "./supabase";

export type ReactionType = "critical" | "market" | "noise";

export interface ReactionCounts {
  critical: number;
  market: number;
  noise: number;
  total: number;
  userVote?: ReactionType | null;
}

// hashIP removed - reactions now use user_id instead of IP fingerprints

/**
 * Get reaction counts for an event
 */
export async function getReactionCounts(eventId: string): Promise<ReactionCounts> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("reaction_counts")
    .select("critical, market, noise, total")
    .eq("event_id", eventId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = not found
    console.error("[Reactions] Error fetching counts:", error);
  }

  return {
    critical: data?.critical || 0,
    market: data?.market || 0,
    noise: data?.noise || 0,
    total: data?.total || 0,
  };
}

/**
 * Get reaction counts with user's vote status
 */
export async function getReactionCountsWithUserVote(
  eventId: string,
  userId: string | null
): Promise<ReactionCounts> {
  const supabase = getSupabaseClient();

  // Get counts (always public)
  const countsResult = await supabase
    .from("reaction_counts")
    .select("critical, market, noise, total")
    .eq("event_id", eventId)
    .single();

  const counts = countsResult.data;

  // Get user vote if authenticated
  let userVote: ReactionType | null = null;
  if (userId) {
    const userVoteResult = await supabase
      .from("reactions")
      .select("reaction_type")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .single();

    userVote = (userVoteResult.data?.reaction_type as ReactionType) || null;
  }

  return {
    critical: counts?.critical || 0,
    market: counts?.market || 0,
    noise: counts?.noise || 0,
    total: counts?.total || 0,
    userVote,
  };
}

/**
 * Cast a vote for an event
 *
 * Returns updated counts or error if already voted the same way
 */
export async function castVote(
  eventId: string,
  userId: string,
  type: ReactionType
): Promise<{ success: boolean; counts?: ReactionCounts; error?: string }> {
  const supabase = getSupabaseClient();

  // Check if user already voted
  const { data: existingVote } = await supabase
    .from("reactions")
    .select("reaction_type")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();

  if (existingVote) {
    // User already voted - check if changing vote
    if (existingVote.reaction_type === type) {
      return { success: false, error: "You already voted this way" };
    }

    // Change vote: update the reaction type
    const { error } = await supabase
      .from("reactions")
      .update({ reaction_type: type })
      .eq("event_id", eventId)
      .eq("user_id", userId);

    if (error) {
      console.error("[Reactions] Error changing vote:", error);
      return { success: false, error: "Failed to change vote" };
    }
  } else {
    // New vote: insert
    const { error } = await supabase.from("reactions").insert({
      event_id: eventId,
      user_id: userId,
      reaction_type: type,
    });

    if (error) {
      console.error("[Reactions] Error casting vote:", error);
      return { success: false, error: "Failed to cast vote" };
    }
  }

  // Return updated counts
  const counts = await getReactionCountsWithUserVote(eventId, userId);
  return { success: true, counts };
}

/**
 * Remove a user's vote
 */
export async function removeVote(
  eventId: string,
  userId: string
): Promise<{ success: boolean; counts?: ReactionCounts; error?: string }> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("reactions")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) {
    console.error("[Reactions] Error removing vote:", error);
    return { success: false, error: "Failed to remove vote" };
  }

  // Return updated counts
  const counts = await getReactionCountsWithUserVote(eventId, userId);
  return { success: true, counts };
}

/**
 * Get ALL reaction counts (global batch)
 *
 * Uses Supabase view for efficient aggregation.
 * Returns a map of eventId -> ReactionCounts
 */
export async function getAllReactionCounts(): Promise<Record<string, ReactionCounts>> {
  const supabase = getSupabaseClient();
  const results: Record<string, ReactionCounts> = {};

  const { data, error } = await supabase
    .from("reaction_counts")
    .select("event_id, critical, market, noise, total");

  if (error) {
    console.error("[Reactions] Error fetching all counts:", error);
    return results;
  }

  for (const row of data || []) {
    results[row.event_id] = {
      critical: row.critical || 0,
      market: row.market || 0,
      noise: row.noise || 0,
      total: row.total || 0,
    };
  }

  return results;
}
