/**
 * Stripe Checkout API
 *
 * Creates a Stripe Checkout session for upgrading to Pro tier.
 * POST /api/stripe/checkout
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe, getProPriceId } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Validate user session with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { returnUrl } = body;

    if (!returnUrl) {
      return NextResponse.json({ error: "returnUrl is required" }, { status: 400 });
    }

    // Validate returnUrl is on our domain to prevent open redirects
    const allowedOrigin = process.env.NEXT_PUBLIC_BASE_URL || "https://realpolitik.world";
    if (
      !returnUrl.startsWith(allowedOrigin) &&
      !returnUrl.startsWith(new URL(allowedOrigin).origin)
    ) {
      return NextResponse.json({ error: "Invalid return URL" }, { status: 400 });
    }

    // Get user's profile to check for existing Stripe customer
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, tier")
      .eq("id", user.id)
      .single();

    // If already Pro, redirect to portal instead
    if (profile?.tier === "pro") {
      return NextResponse.json(
        { error: "Already subscribed to Pro", redirect: "/api/stripe/portal" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    let customerId = profile?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = customer.id;

      // Store customer ID in profile (using service role for this update)
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      await serviceSupabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);

      console.log(`[Stripe] Created customer ${customerId} for user ${user.id}`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: getProPriceId(),
          quantity: 1,
        },
      ],
      success_url: `${returnUrl}?upgrade=success`,
      cancel_url: `${returnUrl}?upgrade=canceled`,
      metadata: {
        supabase_user_id: user.id,
      },
    });

    console.log(`[Stripe] Created checkout session ${session.id} for user ${user.id}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
