/**
 * User state management - backend-synced across devices
 */

import { getSupabaseClient } from "./supabase";

// ────────────────────────────────────────────────────────────────
// NOTIFICATION INBOX
// ────────────────────────────────────────────────────────────────

export async function getUserInbox(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("user_inbox")
    .select("event_id")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });

  if (error) {
    console.error("Error fetching inbox:", error);
    return [];
  }

  return data?.map((row) => row.event_id) || [];
}

export async function addToInbox(userId: string, eventId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.rpc("add_to_inbox", {
    user_uuid: userId,
    evt_id: eventId,
  });
}

export async function removeFromInbox(userId: string, eventId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.rpc("remove_from_inbox", {
    user_uuid: userId,
    evt_id: eventId,
  });
}

export async function clearInbox(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.rpc("clear_inbox", {
    user_uuid: userId,
  });
}

// ────────────────────────────────────────────────────────────────
// READ EVENTS
// ────────────────────────────────────────────────────────────────

export async function getUserReadEvents(userId: string): Promise<Set<string>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("user_read_events")
    .select("event_id")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching read events:", error);
    return new Set();
  }

  return new Set(data?.map((row) => row.event_id) || []);
}

export async function markEventAsRead(userId: string, eventId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.rpc("mark_event_read", {
    user_uuid: userId,
    evt_id: eventId,
  });
}

export async function markEventsAsRead(userId: string, eventIds: string[]): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.rpc("mark_events_read", {
    user_uuid: userId,
    evt_ids: eventIds,
  });
}

// ────────────────────────────────────────────────────────────────
// LAST VISIT
// ────────────────────────────────────────────────────────────────

export async function getLastVisit(userId: string): Promise<Date | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("user_state")
    .select("last_visit")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return new Date(data.last_visit);
}

export async function updateLastVisit(userId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase.rpc("update_last_visit", {
    user_uuid: userId,
  });
}

export async function getNewEvents(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc("get_new_events", {
    user_uuid: userId,
  });

  if (error) {
    console.error("Error fetching new events:", error);
    return [];
  }

  return data?.map((row: { event_id: string }) => row.event_id) || [];
}
