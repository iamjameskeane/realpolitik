/**
 * Reactions (Analyst Protocol)
 *
 * Three-way voting system: CRITICAL, MARKET, NOISE
 * Uses Redis HASH for counts and SET for voter deduplication.
 */

import { getRedis, hashIP } from "./redis";

export type ReactionType = "critical" | "market" | "noise";

export interface ReactionCounts {
  critical: number;
  market: number;
  noise: number;
  total: number;
  userVote?: ReactionType | null;
}

/**
 * Get reaction counts for an event
 */
export async function getReactionCounts(eventId: string): Promise<ReactionCounts> {
  const redis = getRedis();
  const counts = await redis.hgetall<Record<string, string>>(`event:${eventId}:votes`);

  const critical = parseInt(counts?.critical || "0", 10);
  const market = parseInt(counts?.market || "0", 10);
  const noise = parseInt(counts?.noise || "0", 10);

  return {
    critical,
    market,
    noise,
    total: critical + market + noise,
  };
}

/**
 * Get reaction counts with user's vote status
 */
export async function getReactionCountsWithUserVote(
  eventId: string,
  ip: string
): Promise<ReactionCounts> {
  const redis = getRedis();
  const hashedIP = await hashIP(ip);

  const [counts, userVote] = await Promise.all([
    getReactionCounts(eventId),
    redis.hget<ReactionType>(`event:${eventId}:voter:${hashedIP}`, "type"),
  ]);

  return {
    ...counts,
    userVote: userVote || null,
  };
}

/**
 * Cast a vote for an event
 *
 * Returns updated counts or error if already voted
 */
export async function castVote(
  eventId: string,
  ip: string,
  type: ReactionType
): Promise<{ success: boolean; counts?: ReactionCounts; error?: string }> {
  const redis = getRedis();
  const hashedIP = await hashIP(ip);
  const voterKey = `event:${eventId}:voter:${hashedIP}`;
  const votesKey = `event:${eventId}:votes`;

  // Check if user already voted
  const existingVote = await redis.hget<ReactionType>(voterKey, "type");

  if (existingVote) {
    // User already voted - check if changing vote
    if (existingVote === type) {
      return { success: false, error: "You already voted this way" };
    }

    // Change vote: decrement old, increment new
    const pipeline = redis.pipeline();
    pipeline.hincrby(votesKey, existingVote, -1);
    pipeline.hincrby(votesKey, type, 1);
    pipeline.hset(voterKey, { type });
    await pipeline.exec();
  } else {
    // New vote
    const pipeline = redis.pipeline();
    pipeline.hincrby(votesKey, type, 1);
    pipeline.hset(voterKey, { type, timestamp: Date.now() });
    // Set 90-day expiry on voter record
    pipeline.expire(voterKey, 60 * 60 * 24 * 90);
    await pipeline.exec();
  }

  // Return updated counts
  const counts = await getReactionCountsWithUserVote(eventId, ip);
  return { success: true, counts };
}

/**
 * Remove a vote (un-vote)
 */
export async function removeVote(
  eventId: string,
  ip: string
): Promise<{ success: boolean; counts?: ReactionCounts; error?: string }> {
  const redis = getRedis();
  const hashedIP = await hashIP(ip);
  const voterKey = `event:${eventId}:voter:${hashedIP}`;
  const votesKey = `event:${eventId}:votes`;

  // Check if user has voted
  const existingVote = await redis.hget<ReactionType>(voterKey, "type");

  if (!existingVote) {
    return { success: false, error: "No vote to remove" };
  }

  // Remove vote
  const pipeline = redis.pipeline();
  pipeline.hincrby(votesKey, existingVote, -1);
  pipeline.del(voterKey);
  await pipeline.exec();

  // Return updated counts
  const counts = await getReactionCounts(eventId);
  return { success: true, counts: { ...counts, userVote: null } };
}

/**
 * Get ALL reaction counts (global batch)
 *
 * Uses KEYS + pipeline for efficiency:
 * - 1 KEYS command to discover all vote hashes
 * - 1 pipeline with N HGETALL commands
 * = 2 Redis round trips regardless of event count
 *
 * Note: KEYS is O(N) but safe for Upstash with <1000 events.
 * If scaling to 5000+, consider maintaining an active_events SET.
 */
export async function getAllReactionCounts(): Promise<Record<string, ReactionCounts>> {
  const redis = getRedis();
  const results: Record<string, ReactionCounts> = {};

  // 1. Discover all vote keys
  const keys = await redis.keys("event:*:votes");

  if (keys.length === 0) {
    return results;
  }

  // 2. Pipeline all HGETALL commands
  const pipeline = redis.pipeline();
  for (const key of keys) {
    pipeline.hgetall(key);
  }

  const responses = await pipeline.exec();

  // 3. Map keys back to event IDs
  for (let i = 0; i < keys.length; i++) {
    // Extract eventId from "event:xxx:votes"
    const eventId = keys[i].replace("event:", "").replace(":votes", "");
    const counts = responses[i] as Record<string, string> | null;

    const critical = parseInt(counts?.critical || "0", 10);
    const market = parseInt(counts?.market || "0", 10);
    const noise = parseInt(counts?.noise || "0", 10);

    results[eventId] = {
      critical,
      market,
      noise,
      total: critical + market + noise,
    };
  }

  return results;
}
