/**
 * Supabase Client for Atlas Knowledge Graph
 *
 * This client is used by the frontend to query events, entities, and the graph.
 * Uses the anon key which respects Row Level Security policies.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Client Management (supports mocking in tests)
// ============================================================================

let _supabaseClient: SupabaseClient | null = null;

/**
 * Get the Supabase client instance.
 * Creates it lazily on first access.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_supabaseClient) return _supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  _supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return _supabaseClient;
}

/**
 * For testing: inject a mock client
 */
export function setSupabaseClient(client: SupabaseClient | null): void {
  _supabaseClient = client;
}

/**
 * For testing: reset client (forces re-creation)
 */
export function resetSupabaseClient(): void {
  _supabaseClient = null;
}

// ============================================================================
// Type definitions matching our schema
// ============================================================================

export interface GeoEventFromDB {
  id: string;
  title: string;
  category: "MILITARY" | "DIPLOMACY" | "ECONOMY" | "UNREST";
  coordinates: [number, number]; // [lng, lat]
  location_name: string;
  region?: string;
  severity: number;
  summary: string;
  timestamp: string;
  last_updated?: string;
  fallout_prediction?: string;
  sources: {
    id: string;
    headline: string;
    summary: string;
    source_name: string;
    source_url: string;
    timestamp: string;
    original_severity?: number;
  }[];
  // V2 fields
  impact_summary?: string;
  cameo_code?: number;
  cameo_label?: string;
  // Reactions (from events_with_reactions view)
  reactions_critical?: number;
  reactions_market?: number;
  reactions_noise?: number;
  reactions_total?: number;
}

export interface EntityFromDB {
  id: string;
  slug: string;
  node_type: string;
  name: string;
  aliases: string[];
  properties: Record<string, unknown>;
  verified: boolean;
}

export interface EdgeFromDB {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  properties: Record<string, unknown>;
  confidence?: number;
  valid_from?: string;
  valid_to?: string;
}

export interface SubgraphResult {
  nodes: EntityFromDB[];
  edges: EdgeFromDB[];
}

// ============================================================================
// Query Options
// ============================================================================

export interface FetchEventsOptions {
  /** Maximum number of events to fetch */
  limit?: number;
  /** Only fetch events from the last N hours */
  hoursAgo?: number;
  /** Fetch events after this timestamp (ISO string) */
  after?: string;
  /** Fetch events before this timestamp (ISO string) */
  before?: string;
}

// ============================================================================
// Query functions
// ============================================================================

/**
 * Fetch events with optional time filtering
 *
 * @param options - Query options for filtering
 * @returns Array of events matching the criteria
 */
export async function fetchEvents(options: FetchEventsOptions = {}): Promise<GeoEventFromDB[]> {
  const { limit = 500, hoursAgo, after, before } = options;

  const client = getSupabaseClient();
  let query = client.from("events_with_reactions").select("*");

  // Apply time filters
  if (hoursAgo) {
    const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
    query = query.gte("timestamp", cutoff);
  }

  if (after) {
    query = query.gte("timestamp", after);
  }

  if (before) {
    query = query.lte("timestamp", before);
  }

  // Order and limit
  const { data, error } = await query.order("timestamp", { ascending: false }).limit(limit);

  if (error) {
    console.error("Error fetching events:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a single event by ID
 * Used for deep linking when event isn't in current window
 */
export async function fetchEvent(id: string): Promise<GeoEventFromDB | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("events_with_reactions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Error fetching event:", error);
    throw error;
  }

  return data;
}

/**
 * Fetch multiple events by IDs
 * Useful for notifications or bookmarks
 */
export async function fetchEventsByIds(ids: string[]): Promise<GeoEventFromDB[]> {
  if (ids.length === 0) return [];

  const client = getSupabaseClient();
  const { data, error } = await client.from("events_with_reactions").select("*").in("id", ids);

  if (error) {
    console.error("Error fetching events by IDs:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch subgraph around a node (for visualization)
 */
export async function fetchSubgraph(nodeId: string, depth = 2): Promise<SubgraphResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_subgraph", { center_id: nodeId, max_depth: depth });

  if (error) {
    console.error("Error fetching subgraph:", error);
    throw error;
  }

  return data as SubgraphResult;
}

/**
 * Fetch causal chain leading to an event
 */
export async function fetchCausalChain(eventId: string, maxDepth = 5) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_causal_chain", {
    event_id: eventId,
    max_depth: maxDepth,
  });

  if (error) {
    console.error("Error fetching causal chain:", error);
    throw error;
  }

  return data;
}

/**
 * Fetch impact chain from an event
 * Uses the updated constellation function signature
 */
export async function fetchImpactChain(
  eventId: string,
  maxDepth = 3,
  minWeight = 0.1,
  minCumulative = 0.05,
  edgesPerNode = 10
) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("get_impact_chain", {
    start_node_id: eventId,
    max_depth: maxDepth,
    min_weight: minWeight,
    min_cumulative: minCumulative,
    edges_per_node: edgesPerNode,
  });

  if (error) {
    console.error("Error fetching impact chain:", error);
    throw error;
  }

  return data;
}

// Note: Reactions are now handled via /api/reactions route using user_id authentication
// See src/lib/reactions.ts for the implementation

/**
 * Fetch all entities (for graph exploration)
 */
export async function fetchEntities(): Promise<EntityFromDB[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("entities")
    .select("*")
    .eq("verified", true)
    .order("hit_count", { ascending: false });

  if (error) {
    console.error("Error fetching entities:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch a single entity by slug
 * Used for deep linking when navigating to /entity/[slug]
 * Falls back to case-insensitive name match if slug not found
 */
export async function fetchEntityBySlug(slug: string): Promise<EntityFromDB | null> {
  const client = getSupabaseClient();

  // First, try exact slug match
  const { data: bySlug, error: slugError } = await client
    .from("entities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!slugError && bySlug) {
    return bySlug;
  }

  // Fallback: try case-insensitive name match
  // Convert slug format to name (e.g., "united-states" -> "united states")
  const nameFromSlug = slug.replace(/-/g, " ");
  const { data: byName, error: nameError } = await client
    .from("entities")
    .select("*")
    .ilike("name", nameFromSlug)
    .limit(1)
    .single();

  if (!nameError && byName) {
    return byName;
  }

  // Both attempts failed
  if (slugError?.code !== "PGRST116") {
    console.error("Error fetching entity by slug:", slugError);
  }

  return null;
}

/**
 * Fetch a single entity by ID
 * Used when we have the UUID but need full entity details
 */
export async function fetchEntityById(id: string): Promise<EntityFromDB | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.from("entities").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Error fetching entity by ID:", error);
    throw error;
  }

  return data;
}
