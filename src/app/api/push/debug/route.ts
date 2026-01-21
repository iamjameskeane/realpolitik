/**
 * GET /api/push/debug
 * 
 * Debug endpoint to check Redis connectivity and list subscriptions.
 * Protected by PUSH_API_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

const SUBSCRIPTION_PREFIX = "push:sub:";

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const expectedToken = `Bearer ${process.env.PUSH_API_SECRET}`;
  
  if (!authHeader || authHeader !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const redis = getRedis();
    
    // Test basic Redis connectivity
    const pingResult = await redis.ping();
    
    // Scan for all subscription keys
    const keys: string[] = [];
    let cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        match: `${SUBSCRIPTION_PREFIX}*`,
        count: 100,
      });
      cursor = Number(result[0]);
      keys.push(...(result[1] as string[]));
    } while (cursor !== 0);

    // Get subscription data
    const subscriptions = [];
    if (keys.length > 0) {
      const values = await redis.mget(...keys);
      for (let i = 0; i < keys.length; i++) {
        const rawValue = values[i];
        if (rawValue) {
          try {
            // Handle case where Redis returns already-parsed object
            const sub = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            subscriptions.push({
              key: keys[i],
              endpoint: (sub.endpoint || sub.subscription?.endpoint || "unknown").substring(0, 60) + "...",
              created: sub.createdAt || sub.created,
              lastUsed: sub.lastUsedAt || sub.lastUsed,
              preferences: sub.preferences,
              rawType: typeof rawValue,
              rawPreview: typeof rawValue === 'string' ? rawValue.substring(0, 100) : "object",
            });
          } catch (e) {
            subscriptions.push({ 
              key: keys[i], 
              error: "Invalid JSON",
              rawType: typeof rawValue,
              rawPreview: String(rawValue).substring(0, 200),
              parseError: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }
    }

    return NextResponse.json({
      redis: {
        connected: pingResult === "PONG",
        ping: pingResult,
      },
      subscriptions: {
        count: keys.length,
        keys,
        data: subscriptions,
      },
      env: {
        hasVapidPublic: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        hasVapidPrivate: !!process.env.VAPID_PRIVATE_KEY,
        hasPushSecret: !!process.env.PUSH_API_SECRET,
      },
    });
  } catch (error) {
    console.error("[Debug] Redis error:", error);
    return NextResponse.json({
      error: "Redis connection failed",
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
