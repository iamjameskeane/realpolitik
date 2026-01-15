/**
 * Usage Tracking & Rate Limits
 *
 * Tracks API usage for cost monitoring and enforces:
 * - Daily limits per IP (prevents individual abuse)
 * - Global rate limits (prevents distributed attacks / cost blowup)
 */

import { getRedis, getTodayKey, hashIP } from "./redis";
import {
  DAILY_BRIEFING_LIMIT,
  GLOBAL_BRIEFING_LIMIT_PER_MINUTE,
  SESSION_TOKEN_TTL_MS,
} from "./constants";

// Cost estimates (USD) - GPT-5-mini pricing
const COST_PER_1K_INPUT_TOKENS = 0.00015; // GPT-5-mini input
const COST_PER_1K_OUTPUT_TOKENS = 0.0006; // GPT-5-mini output
const COST_PER_TAVILY_SEARCH = 0.01;

export interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  tavilySearches: number;
}

export interface DailyStats {
  date: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  tavilySearches: number;
  estimatedCost: number;
}

/**
 * Check if an IP has remaining briefing quota for today
 */
export async function checkBriefingLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  const redis = getRedis();
  const hashedIP = await hashIP(ip);
  const today = getTodayKey();
  const key = `briefing:daily:${hashedIP}:${today}`;

  const count = (await redis.get<number>(key)) || 0;
  const remaining = Math.max(0, DAILY_BRIEFING_LIMIT - count);

  return {
    allowed: count < DAILY_BRIEFING_LIMIT,
    remaining,
    limit: DAILY_BRIEFING_LIMIT,
  };
}

/**
 * Increment the daily briefing counter for an IP
 */
export async function incrementBriefingCount(ip: string): Promise<number> {
  const redis = getRedis();
  const hashedIP = await hashIP(ip);
  const today = getTodayKey();
  const key = `briefing:daily:${hashedIP}:${today}`;

  // Increment and set 48h expiry (ensures cleanup even across timezones)
  const count = await redis.incr(key);
  await redis.expire(key, 60 * 60 * 48);

  return count;
}

/**
 * Log usage metrics for a briefing request
 */
export async function logBriefingUsage(usage: UsageRecord): Promise<void> {
  const redis = getRedis();
  const today = getTodayKey();

  // Calculate estimated cost
  const cost =
    (usage.inputTokens / 1000) * COST_PER_1K_INPUT_TOKENS +
    (usage.outputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS +
    usage.tavilySearches * COST_PER_TAVILY_SEARCH;

  // Increment daily counters (all atomic)
  const pipeline = redis.pipeline();
  pipeline.incr(`usage:${today}:requests`);
  pipeline.incrby(`usage:${today}:tokens:in`, usage.inputTokens);
  pipeline.incrby(`usage:${today}:tokens:out`, usage.outputTokens);
  pipeline.incrby(`usage:${today}:searches`, usage.tavilySearches);
  pipeline.incrbyfloat(`usage:${today}:cost`, cost);
  pipeline.incrbyfloat(`usage:total:cost`, cost);

  // Set 30-day expiry on daily keys
  pipeline.expire(`usage:${today}:requests`, 60 * 60 * 24 * 30);
  pipeline.expire(`usage:${today}:tokens:in`, 60 * 60 * 24 * 30);
  pipeline.expire(`usage:${today}:tokens:out`, 60 * 60 * 24 * 30);
  pipeline.expire(`usage:${today}:searches`, 60 * 60 * 24 * 30);
  pipeline.expire(`usage:${today}:cost`, 60 * 60 * 24 * 30);

  await pipeline.exec();
}

/**
 * Get usage stats for a specific date
 */
export async function getDailyStats(date?: string): Promise<DailyStats> {
  const redis = getRedis();
  const targetDate = date || getTodayKey();

  const [requests, inputTokens, outputTokens, searches, cost] = await Promise.all([
    redis.get<number>(`usage:${targetDate}:requests`),
    redis.get<number>(`usage:${targetDate}:tokens:in`),
    redis.get<number>(`usage:${targetDate}:tokens:out`),
    redis.get<number>(`usage:${targetDate}:searches`),
    redis.get<number>(`usage:${targetDate}:cost`),
  ]);

  return {
    date: targetDate,
    requests: requests || 0,
    inputTokens: inputTokens || 0,
    outputTokens: outputTokens || 0,
    tavilySearches: searches || 0,
    estimatedCost: cost || 0,
  };
}

/**
 * Get total all-time cost
 */
export async function getTotalCost(): Promise<number> {
  const redis = getRedis();
  return (await redis.get<number>(`usage:total:cost`)) || 0;
}

/**
 * Get usage stats for the last N days
 */
export async function getUsageHistory(days: number = 7): Promise<DailyStats[]> {
  const stats: DailyStats[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split("T")[0];
    stats.push(await getDailyStats(dateKey));
  }

  return stats;
}

// =============================================================================
// GLOBAL RATE LIMITING
// =============================================================================

/**
 * Get the current minute key for global rate limiting
 * Format: YYYY-MM-DD-HH-MM
 */
function getCurrentMinuteKey(): string {
  const now = new Date();
  return `${now.toISOString().slice(0, 16).replace(/[T:]/g, "-")}`;
}

/**
 * Check if global rate limit allows a new request
 * Returns whether the request is allowed and increments the counter atomically
 */
export async function checkAndIncrementGlobalLimit(): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  const redis = getRedis();
  const minuteKey = getCurrentMinuteKey();
  const key = `briefing:global:${minuteKey}`;

  // Increment and get the new count atomically
  const count = await redis.incr(key);

  // Set expiry on first increment (2 minutes to handle edge cases)
  if (count === 1) {
    await redis.expire(key, 120);
  }

  return {
    allowed: count <= GLOBAL_BRIEFING_LIMIT_PER_MINUTE,
    current: count,
    limit: GLOBAL_BRIEFING_LIMIT_PER_MINUTE,
  };
}

// =============================================================================
// SESSION TOKEN MANAGEMENT
// =============================================================================

/**
 * Store a session token after successful PoW verification
 * Token is tied to the client IP for additional security
 */
export async function storeSessionToken(token: string, ip: string): Promise<void> {
  const redis = getRedis();
  const hashedIP = await hashIP(ip);
  const key = `briefing:session:${token}`;

  // Store IP hash with the token for validation
  await redis.set(key, hashedIP, {
    ex: Math.floor(SESSION_TOKEN_TTL_MS / 1000),
  });
}

/**
 * Validate a session token
 * Returns true if token exists and matches the client IP
 */
export async function validateSessionToken(token: string, ip: string): Promise<boolean> {
  const redis = getRedis();
  const hashedIP = await hashIP(ip);
  const key = `briefing:session:${token}`;

  const storedIP = await redis.get<string>(key);

  // Token must exist and match the IP
  return storedIP === hashedIP;
}

/**
 * Invalidate a session token (e.g., on logout or abuse detection)
 */
export async function invalidateSessionToken(token: string): Promise<void> {
  const redis = getRedis();
  const key = `briefing:session:${token}`;
  await redis.del(key);
}
