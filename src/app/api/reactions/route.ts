/**
 * Reactions API (Analyst Protocol)
 *
 * GET /api/reactions - Get ALL reaction counts (global batch, cached)
 * GET /api/reactions?eventId=xxx - Get reaction counts for single event (with user vote)
 * POST /api/reactions - Cast or change a vote
 * DELETE /api/reactions - Remove a vote
 *
 * Requires authentication - reactions are linked to user accounts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getReactionCountsWithUserVote,
  castVote,
  removeVote,
  getAllReactionCounts,
  ReactionType,
} from "@/lib/reactions";

/**
 * GET - Fetch reaction counts
 *
 * No params: Returns ALL reactions (global batch for map/list display)
 * ?eventId=xxx: Returns single event with user vote status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    // Single event request (includes user vote status) - used by voting UI
    if (eventId) {
      // Get user ID from auth header
      const authHeader = request.headers.get("authorization");
      let userId: string | null = null;

      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id || null;
      }

      const counts = await getReactionCountsWithUserVote(eventId, userId);
      return NextResponse.json({ counts });
    }

    // Global batch: Return ALL reactions
    // This enables a static SWR key and eliminates cache thrashing
    const counts = await getAllReactionCounts();

    return NextResponse.json(
      { counts },
      {
        headers: {
          // Edge cache for 30s, serve stale for 60s while revalidating
          // This means multiple users = 1 Redis call per 30s
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[Reactions] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST - Cast or change a vote
 *
 * Rate limiting note: This endpoint requires authentication and only allows
 * 1 vote per event per user (enforced by database). Spam is limited to
 * vote/unvote toggles on the same event, which has minimal impact.
 */
export async function POST(request: NextRequest) {
  try {
    // Auth required
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, type } = body as { eventId: string; type: ReactionType };

    // Validate
    if (!eventId || !type) {
      return NextResponse.json({ error: "eventId and type required" }, { status: 400 });
    }

    if (!["critical", "market", "noise"].includes(type)) {
      return NextResponse.json({ error: "Invalid reaction type" }, { status: 400 });
    }

    const result = await castVote(eventId, user.id, type);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ success: true, counts: result.counts });
  } catch (error) {
    console.error("[Reactions] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE - Remove a vote
 */
export async function DELETE(request: NextRequest) {
  try {
    // Auth required
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
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
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("eventId");

    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const result = await removeVote(eventId, user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ success: true, counts: result.counts });
  } catch (error) {
    console.error("[Reactions] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
