/**
 * Stripe Customer Portal API
 *
 * Creates a Stripe Customer Portal session for managing subscriptions.
 * POST /api/stripe/portal
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

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

    // Get user's Stripe customer ID
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No subscription found" }, { status: 400 });
    }

    const stripe = getStripe();

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    console.log(`[Stripe] Created portal session for user ${user.id}`);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Stripe Portal] Error:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
