/**
 * Server-side push notification utilities
 *
 * Uses web-push library for VAPID authentication and encryption.
 * Subscriptions stored in Upstash Redis.
 */

import webpush from "web-push";
import { getRedis } from "./redis";
import crypto from "crypto";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Initialize web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@realpolitik.world";

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (!vapidConfigured && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
  }
}

// Environment prefix to separate dev/staging/prod subscriptions
const ENV_PREFIX = process.env.VERCEL_ENV === "production" ? "prod" : "dev";

// Redis key patterns (environment-scoped to prevent cross-env notifications)
const SUBSCRIPTION_PREFIX = `push:${ENV_PREFIX}:sub:`;
const STATS_SENT_KEY = `push:${ENV_PREFIX}:stats:sent`;
const STATS_FAILED_KEY = `push:${ENV_PREFIX}:stats:failed`;

// Subscription TTL: 90 days (subscriptions that haven't been used)
const SUBSCRIPTION_TTL_SECONDS = 90 * 24 * 60 * 60;

// =============================================================================
// TYPES
// =============================================================================

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  preferences: {
    enabled: boolean;
    minSeverity: number; // 1-10, only notify if event severity >= this
    categories: ("MILITARY" | "DIPLOMACY" | "ECONOMY" | "UNREST")[];
  };
  userAgent: string;
  createdAt: string;
  lastUsedAt: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  id?: string;
  severity?: number;
  category?: string;
  icon?: string;
  tag?: string;
}

export interface SendResult {
  success: number;
  failed: number;
  removed: number; // Expired/invalid subscriptions cleaned up
}

// Type for the subscription object from client
export interface ClientPushSubscription {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * Generate a deterministic hash for a subscription endpoint.
 * Used as Redis key to prevent duplicates.
 */
function hashEndpoint(endpoint: string): string {
  return crypto.createHash("sha256").update(endpoint).digest("hex").substring(0, 32);
}

/**
 * Store a push subscription in Redis.
 */
export async function storeSubscription(
  subscription: ClientPushSubscription,
  preferences: PushSubscriptionData["preferences"],
  userAgent: string
): Promise<void> {
  console.log("[Push] storeSubscription: Starting...");
  
  const redis = getRedis();
  const hash = hashEndpoint(subscription.endpoint);
  const key = `${SUBSCRIPTION_PREFIX}${hash}`;

  console.log(`[Push] storeSubscription: Key=${key.substring(0, 30)}...`);

  const data: PushSubscriptionData = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys?.p256dh || "",
      auth: subscription.keys?.auth || "",
    },
    preferences,
    userAgent,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
  };

  try {
    await redis.set(key, JSON.stringify(data), { ex: SUBSCRIPTION_TTL_SECONDS });
    console.log("[Push] storeSubscription: Success");
  } catch (error) {
    console.error("[Push] storeSubscription: Error:", error);
    throw error;
  }
}

/**
 * Remove a push subscription from Redis.
 */
export async function removeSubscription(endpoint: string): Promise<boolean> {
  const redis = getRedis();
  const hash = hashEndpoint(endpoint);
  const key = `${SUBSCRIPTION_PREFIX}${hash}`;

  const result = await redis.del(key);
  return result > 0;
}

/**
 * Get all active subscriptions from Redis.
 * Uses SCAN for memory efficiency with large subscription counts.
 */
export async function getAllSubscriptions(): Promise<PushSubscriptionData[]> {
  console.log("[Push] getAllSubscriptions: Starting...");
  
  const redis = getRedis();
  const subscriptions: PushSubscriptionData[] = [];

  // Use scan to iterate through all subscription keys
  let cursor = 0;
  let iterationCount = 0;
  const MAX_ITERATIONS = 100; // Safety limit
  const seenKeys = new Set<string>(); // Prevent duplicates

  try {
    do {
      iterationCount++;
      
      if (iterationCount > MAX_ITERATIONS) {
        console.warn("[Push] getAllSubscriptions: Exceeded max iterations, breaking");
        break;
      }

      console.log(`[Push] getAllSubscriptions: SCAN iteration ${iterationCount}, cursor=${cursor}`);
      
      const scanResult = await redis.scan(cursor, {
        match: `${SUBSCRIPTION_PREFIX}*`,
        count: 100,
      });

      // Upstash returns [cursor, keys] - cursor can be string or number
      const nextCursor = Number(scanResult[0]);
      const keys = scanResult[1] as string[];
      cursor = nextCursor;
      
      console.log(`[Push] getAllSubscriptions: Got ${keys.length} keys, next cursor=${cursor}`);

      if (keys.length > 0) {
        // Filter out already-seen keys to prevent duplicates
        const newKeys = keys.filter(k => !seenKeys.has(k));
        newKeys.forEach(k => seenKeys.add(k));
        
        if (newKeys.length > 0) {
          const values = await redis.mget(...newKeys);
          console.log(`[Push] getAllSubscriptions: MGET returned ${values.length} values`);
          
          for (const value of values) {
            if (value) {
              try {
                // Upstash returns already-parsed objects, not strings
                const sub = typeof value === 'string' 
                  ? JSON.parse(value) as PushSubscriptionData
                  : value as PushSubscriptionData;
                subscriptions.push(sub);
              } catch (e) {
                console.warn("[Push] getAllSubscriptions: Failed to parse subscription JSON:", e);
              }
            }
          }
        }
      }
    } while (cursor !== 0);
  } catch (error) {
    console.error("[Push] getAllSubscriptions: Error during scan:", error);
    throw error;
  }

  console.log(`[Push] getAllSubscriptions: Complete, found ${subscriptions.length} subscriptions`);
  return subscriptions;
}

/**
 * Update last used timestamp for a subscription.
 * NOTE: This is expensive (GET + SET per call), so we skip it during bulk sends.
 * The subscription TTL (90 days) provides enough buffer without constant updates.
 */
async function touchSubscription(endpoint: string): Promise<void> {
  // DISABLED for efficiency - each call costs 2 Redis operations
  // The 90-day TTL on subscriptions is sufficient without constant refreshing.
  // Subscriptions are refreshed on resubscribe anyway.
  return;
  
  // Original implementation (kept for reference):
  // const redis = getRedis();
  // const hash = hashEndpoint(endpoint);
  // const key = `${SUBSCRIPTION_PREFIX}${hash}`;
  // const existing = await redis.get<string>(key);
  // if (existing) {
  //   const data = typeof existing === "string" ? JSON.parse(existing) : existing;
  //   data.lastUsedAt = new Date().toISOString();
  //   await redis.set(key, JSON.stringify(data), { ex: SUBSCRIPTION_TTL_SECONDS });
  // }
}

// =============================================================================
// SENDING NOTIFICATIONS
// =============================================================================

/**
 * Send a push notification to a single subscription.
 * Returns true if successful, false if should be removed.
 */
async function sendToSubscription(
  subscription: PushSubscriptionData,
  payload: NotificationPayload
): Promise<{ success: boolean; shouldRemove: boolean }> {
  console.log(`[Push] sendToSubscription: Sending to ${subscription.endpoint.substring(0, 50)}...`);
  
  ensureVapidConfigured();

  try {
    console.log("[Push] sendToSubscription: Calling webpush.sendNotification...");
    
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60, // 1 hour TTL
        urgency: (payload.severity || 5) >= 8 ? "high" : "normal",
      }
    );

    console.log("[Push] sendToSubscription: Success!");

    // Update last used timestamp
    await touchSubscription(subscription.endpoint);

    return { success: true, shouldRemove: false };
  } catch (error: unknown) {
    // Handle specific error codes
    const webPushError = error as { statusCode?: number; message?: string };
    const statusCode = webPushError.statusCode;

    console.log(`[Push] sendToSubscription: Error - statusCode=${statusCode}, message=${webPushError.message}`);

    if (statusCode === 404 || statusCode === 410) {
      // 404: Not Found - subscription doesn't exist
      // 410: Gone - subscription expired or was unsubscribed
      console.log(`[Push] sendToSubscription: Removing expired subscription: ${statusCode}`);
      return { success: false, shouldRemove: true };
    }

    if (statusCode === 429) {
      // Rate limited - don't remove, just skip
      console.warn("[Push] sendToSubscription: Rate limited, will retry later");
      return { success: false, shouldRemove: false };
    }

    // Other errors - log but don't remove
    console.error("[Push] sendToSubscription: Failed:", webPushError.message || error);
    return { success: false, shouldRemove: false };
  }
}

/**
 * Send notification to all subscriptions matching the criteria.
 * Handles filtering by preferences, batch sending, and cleanup.
 */
export async function sendNotificationToAll(
  payload: NotificationPayload,
  options?: {
    category?: string;
    minSeverity?: number;
  }
): Promise<SendResult> {
  console.log("[Push] sendNotificationToAll called with:", payload.title);
  
  const redis = getRedis();
  console.log("[Push] Getting subscriptions...");
  const subscriptions = await getAllSubscriptions();
  console.log("[Push] Found", subscriptions.length, "subscriptions");

  const result: SendResult = {
    success: 0,
    failed: 0,
    removed: 0,
  };

  if (subscriptions.length === 0) {
    console.log("[Push] No subscriptions to send to");
    return result;
  }

  console.log(`[Push] Sending to ${subscriptions.length} subscriptions...`);

  // Filter subscriptions based on their preferences
  const eligibleSubscriptions = subscriptions.filter((sub) => {
    // Must be enabled
    if (!sub.preferences.enabled) return false;

    // Check severity threshold
    const eventSeverity = payload.severity || 5;
    if (eventSeverity < sub.preferences.minSeverity) return false;

    // Check category filter
    if (options?.category && sub.preferences.categories.length > 0) {
      if (
        !sub.preferences.categories.includes(
          options.category as "MILITARY" | "DIPLOMACY" | "ECONOMY" | "UNREST"
        )
      ) {
        return false;
      }
    }

    return true;
  });

  console.log(`[Push] ${eligibleSubscriptions.length} subscriptions match criteria`);

  // Send in parallel batches of 50
  const BATCH_SIZE = 50;
  const toRemove: string[] = [];

  for (let i = 0; i < eligibleSubscriptions.length; i += BATCH_SIZE) {
    const batch = eligibleSubscriptions.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(batch.map((sub) => sendToSubscription(sub, payload)));

    for (let j = 0; j < results.length; j++) {
      if (results[j].success) {
        result.success++;
      } else {
        result.failed++;
      }

      if (results[j].shouldRemove) {
        toRemove.push(batch[j].endpoint);
        result.removed++;
      }
    }
  }

  // Clean up expired subscriptions
  if (toRemove.length > 0) {
    await Promise.all(toRemove.map((endpoint) => removeSubscription(endpoint)));
    console.log(`[Push] Cleaned up ${toRemove.length} expired subscriptions`);
  }

  // Update stats
  await redis.incrby(STATS_SENT_KEY, result.success);
  await redis.incrby(STATS_FAILED_KEY, result.failed);

  console.log(
    `[Push] Complete: ${result.success} sent, ${result.failed} failed, ${result.removed} removed`
  );

  return result;
}

/**
 * Get push notification statistics.
 */
export async function getPushStats(): Promise<{
  totalSubscriptions: number;
  totalSent: number;
  totalFailed: number;
}> {
  const redis = getRedis();

  const [subscriptions, sent, failed] = await Promise.all([
    getAllSubscriptions(),
    redis.get<number>(STATS_SENT_KEY),
    redis.get<number>(STATS_FAILED_KEY),
  ]);

  return {
    totalSubscriptions: subscriptions.length,
    totalSent: sent || 0,
    totalFailed: failed || 0,
  };
}
