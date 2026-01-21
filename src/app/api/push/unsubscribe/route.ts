/**
 * DELETE /api/push/unsubscribe
 *
 * Removes a push subscription from Redis.
 * Called when user disables notifications.
 */

import { NextRequest, NextResponse } from "next/server";
import { removeSubscription } from "@/lib/push";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { endpoint } = body as { endpoint?: string };

    if (!endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const removed = await removeSubscription(endpoint);

    console.log(`[Unsubscribe] ${removed ? "Removed" : "Not found"}: ${endpoint.substring(0, 50)}...`);

    return NextResponse.json({ success: true, removed });
  } catch (error) {
    console.error("[Unsubscribe] Error:", error);
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }
}
