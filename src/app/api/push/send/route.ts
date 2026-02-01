/**
 * POST /api/push/send
 *
 * INTERNAL ENDPOINT - Sends push notifications to all matching subscriptions.
 * Called by Python worker when new high-severity events are detected.
 *
 * Authentication: Bearer token in Authorization header (PUSH_API_SECRET)
 */

import { NextRequest, NextResponse } from "next/server";
import { sendNotificationToAll, NotificationPayload } from "@/lib/pushSupabase";

export async function POST(request: NextRequest) {
  console.log("[Send] Received push send request");

  try {
    // Authenticate request
    const authHeader = request.headers.get("authorization");
    const secret = process.env.PUSH_API_SECRET;
    const expectedToken = `Bearer ${secret}`;

    if (!authHeader || authHeader !== expectedToken) {
      console.warn("[Send] Unauthorized request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate payload
    const {
      title,
      body: notifBody,
      url,
      id,
      severity,
      category,
      region,
      location_name,
      sources_count,
      critical,
    } = body as {
      title?: string;
      body?: string;
      url?: string;
      id?: string;
      severity?: number;
      category?: string;
      region?: string;
      location_name?: string;
      sources_count?: number;
      critical?: boolean;
    };

    if (!title || !notifBody) {
      console.log("[Send] Missing title or body");
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }

    console.log("[Send] Payload:", { title, severity, category, region, sources_count });

    const payload: NotificationPayload = {
      title,
      body: notifBody,
      url: url || "/",
      id,
      severity: severity || 5,
      category,
      region,
      location_name,
      sources_count,
      icon: "/android-chrome-192x192.png",
      tag: id || `event-${Date.now()}`,
      critical,
    };

    // Send to all matching subscriptions
    console.log("[Send] Calling sendNotificationToAll...");
    const result = await sendNotificationToAll(payload);

    console.log("[Send] Result:", result);

    return NextResponse.json({
      success: true,
      sent: result.success,
      failed: result.failed,
      removed: result.removed,
    });
  } catch (error) {
    console.error("[Send] Error:", error);
    // Include more error details
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to send notifications", details: errorMessage },
      { status: 500 }
    );
  }
}
