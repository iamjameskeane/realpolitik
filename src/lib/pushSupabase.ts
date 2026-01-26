/**
 * Push notification utilities using Supabase backend
 *
 * Subscriptions are stored in user_push_subscriptions table and linked to user accounts.
 * This replaces the Redis-based push.ts for user-authenticated notifications.
 */

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { shouldSendPush, shouldAddToInbox, type EventForMatching } from "./notificationRules";
import type { NotificationPreferences } from "@/types/notifications";

// =============================================================================
// CONFIGURATION
// =============================================================================

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

// =============================================================================
// TYPES
// =============================================================================

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  id?: string;
  severity?: number;
  category?: string;
  region?: string;
  location_name?: string;
  sources_count?: number;
  icon?: string;
  tag?: string;
  critical?: boolean;
}

export interface SendResult {
  success: number;
  failed: number;
  removed: number;
}

interface SubscriptionRow {
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  preferences: NotificationPreferences;
}

// =============================================================================
// SUBSCRIPTION QUERIES
// =============================================================================

/**
 * Get all active subscriptions from database.
 * Used by /api/push/send to broadcast notifications.
 */
async function getAllActiveSubscriptions(): Promise<SubscriptionRow[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc("get_all_active_subscriptions");

  if (error) {
    console.error("[Push] Error fetching subscriptions:", error);
    throw error;
  }

  return data || [];
}

// =============================================================================
// DEDUPLICATION
// =============================================================================

/**
 * Check if a user has already been notified for this event.
 * Uses user_inbox table to track which events user was notified about.
 */
async function hasBeenNotified(userId: string, eventId: string): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from("user_inbox")
    .select("id")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .single();

  return !!data;
}

/**
 * Mark user as notified for this event by adding to inbox.
 */
async function markAsNotified(userId: string, eventId: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase.rpc("add_to_inbox", {
    user_uuid: userId,
    evt_id: eventId,
  });
}

// =============================================================================
// SENDING NOTIFICATIONS
// =============================================================================

/**
 * Send a push notification to a single subscription.
 * Returns true if successful, false if should be deactivated.
 */
async function sendToSubscription(
  subscription: SubscriptionRow,
  payload: NotificationPayload
): Promise<{ success: boolean; shouldDeactivate: boolean }> {
  ensureVapidConfigured();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh_key,
          auth: subscription.auth_key,
        },
      },
      JSON.stringify(payload),
      {
        TTL: 60 * 60, // 1 hour
        urgency: (payload.severity || 5) >= 8 ? "high" : "normal",
      }
    );

    return { success: true, shouldDeactivate: false };
  } catch (error: unknown) {
    const webPushError = error as { statusCode?: number; message?: string };
    const statusCode = webPushError.statusCode;

    // 404 or 410: subscription expired/invalid
    if (statusCode === 404 || statusCode === 410) {
      console.log(`[Push] Subscription expired: ${statusCode}`);
      return { success: false, shouldDeactivate: true };
    }

    // Other errors
    console.error("[Push] Send failed:", webPushError.message || error);
    return { success: false, shouldDeactivate: false };
  }
}

/**
 * Send notification to all subscriptions matching the event criteria.
 *
 * Flow:
 * 1. Query all active subscriptions from database
 * 2. For each subscription, check if user was already notified (dedup)
 * 3. Check if event matches any inbox rules (shouldAddToInbox)
 * 4. Check if event matches push rules (shouldSendPush) - only rules with sendPush: true
 * 5. Send push notification if matched
 * 6. Add event to user's inbox (marks as notified for future dedup)
 * 7. Deactivate subscriptions that returned 404/410
 */
export async function sendNotificationToAll(payload: NotificationPayload): Promise<SendResult> {
  console.log("[Push] sendNotificationToAll:", payload.title);

  const result: SendResult = {
    success: 0,
    failed: 0,
    removed: 0,
  };

  try {
    // Get all active subscriptions
    const subscriptions = await getAllActiveSubscriptions();
    console.log(`[Push] Found ${subscriptions.length} active subscriptions`);

    if (subscriptions.length === 0) {
      return result;
    }

    // Build event object for rule matching
    const eventForMatching: EventForMatching = {
      id: payload.id || "",
      title: payload.title,
      category: payload.category || "MILITARY",
      location_name: payload.location_name || "",
      region: payload.region,
      severity: payload.severity || 5,
      sources: payload.sources_count
        ? Array.from({ length: payload.sources_count }, (_, i) => ({ id: `src-${i}` }))
        : [{ id: "default" }],
    };

    // Track deactivated subscriptions
    const toDeactivate: string[] = [];
    const notifiedUsers: { userId: string; eventId: string }[] = [];

    // Process each subscription
    for (const sub of subscriptions) {
      // Skip if user already notified for this event
      if (payload.id) {
        const alreadyNotified = await hasBeenNotified(sub.user_id, payload.id);
        if (alreadyNotified) {
          console.log(`[Push] User ${sub.user_id} already notified, skipping`);
          continue;
        }
      }

      // Check if event matches any inbox rules (determines if we process at all)
      const matchesInbox = shouldAddToInbox(eventForMatching, sub.preferences);
      if (!matchesInbox) {
        continue;
      }

      // Check if event should trigger push (rules with sendPush: true)
      const matchesPush = shouldSendPush(eventForMatching, sub.preferences);

      if (matchesPush) {
        // Send push notification
        const sendResult = await sendToSubscription(sub, payload);

        if (sendResult.success) {
          result.success++;
        } else {
          result.failed++;
        }

        if (sendResult.shouldDeactivate) {
          toDeactivate.push(sub.endpoint);
          result.removed++;
        }
      }

      // Always add to inbox if event matched any rule (marks as notified)
      if (payload.id) {
        notifiedUsers.push({ userId: sub.user_id, eventId: payload.id });
      }
    }

    // Deactivate expired subscriptions
    if (toDeactivate.length > 0) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      for (const endpoint of toDeactivate) {
        await supabase.rpc("deactivate_push_subscription", {
          sub_endpoint: endpoint,
        });
      }

      console.log(`[Push] Deactivated ${toDeactivate.length} expired subscriptions`);
    }

    // Add to all users' inboxes (marks as notified)
    if (notifiedUsers.length > 0) {
      for (const { userId, eventId } of notifiedUsers) {
        await markAsNotified(userId, eventId);
      }

      console.log(`[Push] Added to ${notifiedUsers.length} user inboxes`);
    }

    console.log(
      `[Push] Complete: ${result.success} sent, ${result.failed} failed, ${result.removed} removed`
    );

    return result;
  } catch (error) {
    console.error("[Push] Error in sendNotificationToAll:", error);
    throw error;
  }
}
