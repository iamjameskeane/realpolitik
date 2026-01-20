/**
 * POST /api/push/subscribe
 *
 * Receives a PushSubscription from the client and stores it in Redis.
 * Called when user enables notifications or updates preferences.
 *
 * Supports both legacy preferences (minSeverity + categories) and
 * new rule-based preferences for granular notification filtering.
 */

import { NextRequest, NextResponse } from "next/server";
import { storeSubscription, ClientPushSubscription, StoredPreferences } from "@/lib/push";
import type { NotificationPreferences, LegacyPreferences } from "@/types/notifications";
import { DEFAULT_PREFERENCES, RULE_LIMITS, validatePreferences } from "@/types/notifications";

// Type guard for new preferences format
function isNewFormat(prefs: unknown): prefs is NotificationPreferences {
  return (
    typeof prefs === "object" &&
    prefs !== null &&
    "rules" in prefs &&
    Array.isArray((prefs as NotificationPreferences).rules)
  );
}

// Type guard for legacy preferences format
function isLegacyFormat(prefs: unknown): prefs is LegacyPreferences {
  return (
    typeof prefs === "object" &&
    prefs !== null &&
    "minSeverity" in prefs &&
    !("rules" in prefs)
  );
}

export async function POST(request: NextRequest) {
  console.log("[Subscribe] Received subscription request");
  
  try {
    const body = await request.json();
    console.log("[Subscribe] Parsed body, checking subscription...");

    const { subscription, preferences, resubscribe } = body as {
      subscription: ClientPushSubscription;
      preferences?: Partial<NotificationPreferences> | Partial<LegacyPreferences>;
      resubscribe?: boolean;
    };

    // Validate subscription object
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      console.log("[Subscribe] Invalid subscription object - missing required fields");
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
    }

    console.log(`[Subscribe] Valid subscription for endpoint: ${subscription.endpoint.substring(0, 50)}...`);

    // Determine preferences format and build stored preferences
    let prefs: StoredPreferences;
    
    if (isNewFormat(preferences)) {
      // Validate rule limits
      if (preferences.rules.length > RULE_LIMITS.MAX_RULES) {
        return NextResponse.json(
          { error: `Maximum ${RULE_LIMITS.MAX_RULES} rules allowed` },
          { status: 400 }
        );
      }
      
      // Validate each rule
      const validation = validatePreferences(preferences as NotificationPreferences);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      
      // New rule-based format
      prefs = {
        enabled: preferences.enabled ?? true,
        rules: preferences.rules,
        mode: preferences.mode ?? "realtime",
        digestTime: preferences.digestTime,
        quietHours: preferences.quietHours,
      };
      console.log("[Subscribe] Using new rule-based preferences:", prefs.rules?.length, "rules");
    } else if (isLegacyFormat(preferences)) {
      // Legacy format (minSeverity + categories)
      prefs = {
        enabled: preferences.enabled ?? true,
        minSeverity: preferences.minSeverity ?? 8,
        categories: preferences.categories ?? ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"],
      };
      console.log("[Subscribe] Using legacy preferences:", prefs);
    } else {
      // Default to new format with default rule
      prefs = {
        ...DEFAULT_PREFERENCES,
        enabled: true,
      };
      console.log("[Subscribe] Using default rule-based preferences");
    }

    // Get user agent for debugging
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Store subscription
    console.log("[Subscribe] Storing subscription in Redis...");
    await storeSubscription(subscription, prefs, userAgent);

    console.log(
      `[Subscribe] ${resubscribe ? "Re-subscribed" : "New subscription"}: ${subscription.endpoint.substring(0, 50)}...`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Subscribe] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Failed to store subscription", details: errorMessage }, { status: 500 });
  }
}
