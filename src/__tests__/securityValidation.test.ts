import { describe, it, expect } from "vitest";

/**
 * Tests for security validation logic added in pre-launch hardening.
 *
 * These tests verify the validation functions that protect against:
 * - Open redirect attacks (Stripe returnUrl)
 * - Authorization bypass (push unsubscribe ownership)
 * - Subscription expiration bypass
 */

describe("Stripe returnUrl Validation", () => {
  const ALLOWED_ORIGIN = "https://realpolitik.world";

  /**
   * Validates that a returnUrl is on the allowed domain.
   * Mirrors the logic in /api/stripe/checkout and /api/stripe/portal
   */
  function validateReturnUrl(returnUrl: string, allowedOrigin: string): boolean {
    if (!returnUrl) return false;

    try {
      const returnUrlParsed = new URL(returnUrl);
      const allowedOriginParsed = new URL(allowedOrigin);
      return returnUrlParsed.origin === allowedOriginParsed.origin;
    } catch {
      return false;
    }
  }

  it("should accept URLs starting with allowed origin", () => {
    expect(validateReturnUrl("https://realpolitik.world/settings", ALLOWED_ORIGIN)).toBe(true);
    expect(validateReturnUrl("https://realpolitik.world/", ALLOWED_ORIGIN)).toBe(true);
    expect(validateReturnUrl("https://realpolitik.world", ALLOWED_ORIGIN)).toBe(true);
  });

  it("should accept URLs with query parameters", () => {
    expect(validateReturnUrl("https://realpolitik.world?upgrade=success", ALLOWED_ORIGIN)).toBe(
      true
    );
    expect(
      validateReturnUrl("https://realpolitik.world/settings?tab=billing", ALLOWED_ORIGIN)
    ).toBe(true);
  });

  it("should reject URLs from different domains", () => {
    expect(validateReturnUrl("https://evil.com", ALLOWED_ORIGIN)).toBe(false);
    expect(validateReturnUrl("https://evil.com/redirect", ALLOWED_ORIGIN)).toBe(false);
    expect(validateReturnUrl("https://realpolitik.world.evil.com", ALLOWED_ORIGIN)).toBe(false);
  });

  it("should reject URLs with different protocols", () => {
    expect(validateReturnUrl("http://realpolitik.world", ALLOWED_ORIGIN)).toBe(false);
    expect(validateReturnUrl("javascript:alert(1)", ALLOWED_ORIGIN)).toBe(false);
  });

  it("should reject empty or null URLs", () => {
    expect(validateReturnUrl("", ALLOWED_ORIGIN)).toBe(false);
  });

  it("should reject URLs that try to trick the check", () => {
    // Subdomain attack
    expect(validateReturnUrl("https://realpolitik.world.attacker.com", ALLOWED_ORIGIN)).toBe(false);
    // Similar domain
    expect(validateReturnUrl("https://realpolitik-world.com", ALLOWED_ORIGIN)).toBe(false);
    // @ character attack
    expect(validateReturnUrl("https://realpolitik.world@evil.com", ALLOWED_ORIGIN)).toBe(false);
  });
});

describe("Push Unsubscribe Ownership Validation", () => {
  /**
   * Checks if a subscription belongs to the authenticated user.
   * Mirrors the logic in /api/push/unsubscribe
   */
  function validateOwnership(
    subscription: { user_id: string } | null,
    authenticatedUserId: string
  ): { valid: boolean; reason?: string } {
    if (!subscription) {
      return { valid: false, reason: "Subscription not found" };
    }

    if (subscription.user_id !== authenticatedUserId) {
      return { valid: false, reason: "Not authorized" };
    }

    return { valid: true };
  }

  it("should allow user to delete their own subscription", () => {
    const subscription = { user_id: "user-123" };
    const result = validateOwnership(subscription, "user-123");
    expect(result.valid).toBe(true);
  });

  it("should reject deletion of another user's subscription", () => {
    const subscription = { user_id: "user-123" };
    const result = validateOwnership(subscription, "attacker-456");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Not authorized");
  });

  it("should reject deletion of non-existent subscription", () => {
    const result = validateOwnership(null, "user-123");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Subscription not found");
  });
});

describe("Subscription Expiration Check", () => {
  /**
   * Determines the effective tier based on subscription status.
   * Mirrors the logic in /api/briefing/route.ts
   */
  function getEffectiveTier(profile: {
    tier: string;
    subscription_status?: string;
    subscription_ends_at?: string | null;
  }): string {
    // If not Pro, return as-is
    if (profile.tier !== "pro") {
      return profile.tier;
    }

    // Check if subscription has expired
    if (
      profile.subscription_status === "canceled" &&
      profile.subscription_ends_at &&
      new Date(profile.subscription_ends_at) < new Date()
    ) {
      return "free"; // Expired subscription
    }

    return profile.tier;
  }

  it("should return pro for active subscription", () => {
    const profile = {
      tier: "pro",
      subscription_status: "active",
      subscription_ends_at: null,
    };
    expect(getEffectiveTier(profile)).toBe("pro");
  });

  it("should return pro for canceled subscription that hasn't expired yet", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    const profile = {
      tier: "pro",
      subscription_status: "canceled",
      subscription_ends_at: futureDate.toISOString(),
    };
    expect(getEffectiveTier(profile)).toBe("pro");
  });

  it("should return free for canceled subscription that has expired", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    const profile = {
      tier: "pro",
      subscription_status: "canceled",
      subscription_ends_at: pastDate.toISOString(),
    };
    expect(getEffectiveTier(profile)).toBe("free");
  });

  it("should return free for free tier user", () => {
    const profile = {
      tier: "free",
      subscription_status: "none",
      subscription_ends_at: null,
    };
    expect(getEffectiveTier(profile)).toBe("free");
  });

  it("should return pro for past_due subscription (grace period)", () => {
    const profile = {
      tier: "pro",
      subscription_status: "past_due",
      subscription_ends_at: null,
    };
    expect(getEffectiveTier(profile)).toBe("pro");
  });
});

describe("Briefing Limit Defaults", () => {
  /**
   * Gets the correct limit for a tier.
   * Mirrors the tier-based limits in the database.
   */
  function getTierLimit(tier: string): number {
    switch (tier) {
      case "pro":
        return 50;
      case "enterprise":
        return 200;
      case "free":
      default:
        return 10;
    }
  }

  it("should return 10 for free tier", () => {
    expect(getTierLimit("free")).toBe(10);
  });

  it("should return 50 for pro tier", () => {
    expect(getTierLimit("pro")).toBe(50);
  });

  it("should return 200 for enterprise tier", () => {
    expect(getTierLimit("enterprise")).toBe(200);
  });

  it("should default to 10 for unknown tier", () => {
    expect(getTierLimit("unknown")).toBe(10);
  });
});

describe("Invoice Billing Reason Validation", () => {
  /**
   * Determines if an invoice should trigger subscription handling.
   * Mirrors the logic in /api/stripe/webhook invoice.paid handler.
   */
  function isSubscriptionInvoice(billingReason: string | null): boolean {
    if (!billingReason) return false;
    return ["subscription_create", "subscription_cycle", "subscription_update"].includes(
      billingReason
    );
  }

  it("should recognize subscription creation invoices", () => {
    expect(isSubscriptionInvoice("subscription_create")).toBe(true);
  });

  it("should recognize subscription cycle invoices", () => {
    expect(isSubscriptionInvoice("subscription_cycle")).toBe(true);
  });

  it("should recognize subscription update invoices", () => {
    expect(isSubscriptionInvoice("subscription_update")).toBe(true);
  });

  it("should reject one-off invoices", () => {
    expect(isSubscriptionInvoice("manual")).toBe(false);
  });

  it("should reject null billing reason", () => {
    expect(isSubscriptionInvoice(null)).toBe(false);
  });
});
