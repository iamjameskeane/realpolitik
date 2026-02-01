/**
 * POST /api/push/subscribe
 *
 * Receives a PushSubscription from the client and stores it in Supabase.
 * Called when user enables notifications or updates preferences.
 *
 * Requires authentication - push subscriptions are linked to user accounts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NotificationPreferences } from "@/types/notifications";
import { DEFAULT_PREFERENCES, RULE_LIMITS, validatePreferences } from "@/types/notifications";

interface ClientPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Helper to extract device name from user agent
function getDeviceName(userAgent: string): string {
  // Mobile devices
  if (/iPhone/i.test(userAgent)) return "iPhone Safari";
  if (/iPad/i.test(userAgent)) return "iPad Safari";
  if (/Android.*Chrome/i.test(userAgent)) return "Android Chrome";
  if (/Android.*Firefox/i.test(userAgent)) return "Android Firefox";

  // Desktop browsers
  if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) return "Desktop Chrome";
  if (/Firefox/i.test(userAgent)) return "Desktop Firefox";
  if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) return "Desktop Safari";
  if (/Edge/i.test(userAgent)) return "Desktop Edge";

  return "Unknown Device";
}

export async function POST(request: NextRequest) {
  console.log("[Subscribe] Received subscription request");

  try {
    // ========== AUTHENTICATION ==========
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Authentication required",
          message: "You must be signed in to enable notifications.",
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid session", message: "Please sign in again." },
        { status: 401 }
      );
    }

    console.log(`[Subscribe] Authenticated user: ${user.email}`);

    // ========== ENSURE PROFILE EXISTS ==========
    // Use service role to create profile if it doesn't exist (handles users created before trigger)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data: existingProfile } = await serviceSupabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (!existingProfile) {
      console.log(`[Subscribe] Creating missing profile for user ${user.id}`);
      const { error: profileError } = await serviceSupabase.from("profiles").insert({
        id: user.id,
        email: user.email,
        display_name: user.email?.split("@")[0] || "User",
      });

      if (profileError) {
        console.error("[Subscribe] Failed to create profile:", profileError);
        throw new Error("Failed to create user profile");
      }
    }

    // ========== PARSE REQUEST ==========
    const body = await request.json();
    const { subscription, preferences } = body as {
      subscription: ClientPushSubscription;
      preferences?: Partial<NotificationPreferences>;
    };

    // Validate subscription object
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 });
    }

    // ========== VALIDATE PREFERENCES ==========
    let prefs: NotificationPreferences = { ...DEFAULT_PREFERENCES };

    if (preferences) {
      // Validate rule limits
      if (preferences.rules && preferences.rules.length > RULE_LIMITS.MAX_RULES) {
        return NextResponse.json(
          { error: `Maximum ${RULE_LIMITS.MAX_RULES} rules allowed` },
          { status: 400 }
        );
      }

      // Validate preferences
      const validation = validatePreferences({ ...DEFAULT_PREFERENCES, ...preferences });
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      prefs = { ...DEFAULT_PREFERENCES, ...preferences };
    }

    console.log(`[Subscribe] Preferences: ${prefs.rules?.length || 0} rules`);

    // ========== STORE SUBSCRIPTION ==========
    const userAgent = request.headers.get("user-agent") || "unknown";
    const deviceName = getDeviceName(userAgent);

    const { data, error } = await supabase.rpc("upsert_push_subscription", {
      user_uuid: user.id,
      sub_endpoint: subscription.endpoint,
      sub_p256dh: subscription.keys.p256dh,
      sub_auth: subscription.keys.auth,
      sub_device_name: deviceName,
      sub_user_agent: userAgent,
      sub_preferences: prefs,
    });

    if (error) {
      console.error("[Subscribe] Database error:", error);
      throw error;
    }

    console.log(`[Subscribe] Success: ${deviceName} subscribed`);

    return NextResponse.json({
      success: true,
      deviceName,
      subscriptionId: data,
    });
  } catch (error) {
    console.error("[Subscribe] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to store subscription", details: errorMessage },
      { status: 500 }
    );
  }
}
