/**
 * POST /api/push/subscribe
 *
 * Receives a PushSubscription from the client and stores it in Redis.
 * Called when user enables notifications or updates preferences.
 */

import { NextRequest, NextResponse } from "next/server";
import { storeSubscription, ClientPushSubscription, PushSubscriptionData } from "@/lib/push";

export async function POST(request: NextRequest) {
  console.log("[Subscribe] Received subscription request");
  
  try {
    const body = await request.json();
    console.log("[Subscribe] Parsed body, checking subscription...");

    const { subscription, preferences, resubscribe } = body as {
      subscription: ClientPushSubscription;
      preferences?: Partial<PushSubscriptionData["preferences"]>;
      resubscribe?: boolean;
    };

    // Validate subscription object
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      console.log("[Subscribe] Invalid subscription object - missing required fields");
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
    }

    console.log(`[Subscribe] Valid subscription for endpoint: ${subscription.endpoint.substring(0, 50)}...`);

    // Default preferences if not provided
    const prefs: PushSubscriptionData["preferences"] = {
      enabled: true,
      minSeverity: preferences?.minSeverity ?? 8, // Default: notify on 8+ severity (critical events)
      categories: preferences?.categories ?? ["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"],
    };

    console.log("[Subscribe] Preferences:", prefs);

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
