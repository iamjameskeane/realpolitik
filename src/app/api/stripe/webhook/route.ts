/**
 * Stripe Webhook Handler
 *
 * Handles subscription lifecycle events from Stripe.
 * POST /api/stripe/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, getWebhookSecret } from "@/lib/stripe";
import Stripe from "stripe";

// Disable body parsing - we need the raw body for signature verification
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();

  // Get the raw body as text for signature verification
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.error("[Stripe Webhook] Missing signature");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Stripe Webhook] Signature verification failed: ${message}`);
    return NextResponse.json({ error: `Webhook signature verification failed` }, { status: 400 });
  }

  // Use service role to update profiles
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  console.log(`[Stripe Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Get user ID from metadata
        const userId = session.metadata?.supabase_user_id;
        if (!userId) {
          console.error("[Stripe Webhook] No user ID in session metadata");
          break;
        }

        // Get subscription details
        const subscriptionId = session.subscription as string;

        // Update user to Pro tier
        const { error } = await supabase
          .from("profiles")
          .update({
            tier: "pro",
            stripe_subscription_id: subscriptionId,
            subscription_status: "active",
            subscription_ends_at: null,
          })
          .eq("id", userId);

        if (error) {
          console.error("[Stripe Webhook] Failed to update profile:", error);
        } else {
          console.log(`[Stripe Webhook] User ${userId} upgraded to Pro`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) {
          console.error(`[Stripe Webhook] No profile for customer ${customerId}`);
          break;
        }

        // Handle subscription status changes
        if (subscription.cancel_at_period_end && subscription.cancel_at) {
          // Subscription will cancel at period end
          await supabase
            .from("profiles")
            .update({
              subscription_status: "canceled",
              subscription_ends_at: new Date(subscription.cancel_at * 1000).toISOString(),
            })
            .eq("id", profile.id);

          console.log(
            `[Stripe Webhook] User ${profile.id} subscription will cancel at ${new Date(subscription.cancel_at * 1000).toISOString()}`
          );
        } else if (subscription.status === "active") {
          // Subscription is active (maybe reactivated)
          await supabase
            .from("profiles")
            .update({
              tier: "pro",
              subscription_status: "active",
              subscription_ends_at: null,
            })
            .eq("id", profile.id);

          console.log(`[Stripe Webhook] User ${profile.id} subscription active`);
        } else if (subscription.status === "past_due") {
          // Payment failed
          await supabase
            .from("profiles")
            .update({
              subscription_status: "past_due",
            })
            .eq("id", profile.id);

          console.log(`[Stripe Webhook] User ${profile.id} subscription past due`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) {
          console.error(`[Stripe Webhook] No profile for customer ${customerId}`);
          break;
        }

        // Downgrade to free tier
        await supabase
          .from("profiles")
          .update({
            tier: "free",
            stripe_subscription_id: null,
            subscription_status: "none",
            subscription_ends_at: null,
          })
          .eq("id", profile.id);

        console.log(`[Stripe Webhook] User ${profile.id} downgraded to free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find user by Stripe customer ID
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!profile) {
          console.error(`[Stripe Webhook] No profile for customer ${customerId}`);
          break;
        }

        // Mark as past due
        await supabase
          .from("profiles")
          .update({
            subscription_status: "past_due",
          })
          .eq("id", profile.id);

        console.log(`[Stripe Webhook] User ${profile.id} payment failed`);
        // TODO: Optionally send email to user about payment failure
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error processing event:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
