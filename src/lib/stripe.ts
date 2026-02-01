/**
 * Stripe Client for Pro Tier Subscriptions
 *
 * Server-side only - uses STRIPE_SECRET_KEY
 */

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * Get the Stripe client instance (server-side only)
 */
export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }

  stripeClient = new Stripe(secretKey);

  return stripeClient;
}

/**
 * Get the Pro subscription price ID
 */
export function getProPriceId(): string {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PRO_PRICE_ID environment variable is not set");
  }
  return priceId;
}

/**
 * Get the webhook signing secret
 */
export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET environment variable is not set");
  }
  return secret;
}
