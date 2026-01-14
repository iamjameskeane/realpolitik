/**
 * Shared Redis client for Upstash
 *
 * Used for:
 * - Daily briefing limits (cost control)
 * - Usage tracking
 * - Reactions (Analyst Protocol votes)
 */

import { Redis } from "@upstash/redis";

// Lazy initialization to avoid build-time errors
let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN environment variables"
      );
    }

    redisClient = new Redis({ url, token });
  }

  return redisClient;
}

/**
 * Get today's date key in YYYY-MM-DD format
 */
export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Hash an IP address for privacy (we don't store raw IPs)
 *
 * Uses SHA-256 with a secret salt. The salt MUST be set via IP_SALT
 * environment variable in production for proper privacy protection.
 */
let ipSaltWarningLogged = false;

export async function hashIP(ip: string): Promise<string> {
  const salt = process.env.IP_SALT;

  // Warn once if salt is missing in production
  if (!salt && process.env.NODE_ENV === "production" && !ipSaltWarningLogged) {
    console.error(
      "[Security] IP_SALT environment variable is not set. " +
        "Using fallback salt reduces privacy protection. " +
        "Please set IP_SALT in your environment variables."
    );
    ipSaltWarningLogged = true;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (salt || "realpolitik-salt"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
