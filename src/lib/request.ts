/**
 * Shared request utilities for API routes
 */

import { NextRequest } from "next/server";

/**
 * Get client IP from request headers
 *
 * Checks x-forwarded-for (proxies/load balancers) and x-real-ip headers
 * before falling back to localhost for development.
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback (will be 127.0.0.1 in development)
  return "127.0.0.1";
}
