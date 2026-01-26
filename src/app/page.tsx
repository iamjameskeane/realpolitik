import { ClientPage } from "./ClientPage";
import { GeoEvent } from "@/types/events";
import { createClient } from "@supabase/supabase-js";

// Default SSR time window: last 24 hours (matches useEvents default)
const SSR_DEFAULT_HOURS = 24;

/**
 * Fetch events from Supabase for SSR
 *
 * Creates a server-side Supabase client to fetch events.
 * Only fetches recent events (default: last 7 days) for faster initial load.
 * The data is passed to the client and used as SWR's initial data.
 */
async function getEvents(): Promise<GeoEvent[]> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables for SSR");
      return [];
    }

    // Create a server-side client (no session persistence needed)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // Calculate time cutoff for SSR (default: 7 days)
    const cutoff = new Date(Date.now() - SSR_DEFAULT_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("events_with_reactions")
      .select("*")
      .gte("timestamp", cutoff)
      .order("timestamp", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Error fetching events from Supabase:", error);
      return [];
    }

    // Transform Supabase data to GeoEvent interface
    return (data || []).map((event) => ({
      id: event.id,
      title: event.title,
      category: event.category,
      coordinates: event.coordinates,
      location_name: event.location_name,
      region: event.region,
      severity: event.severity,
      summary: event.summary,
      timestamp: event.timestamp,
      last_updated: event.last_updated,
      fallout_prediction: event.fallout_prediction || "",
      sources: event.sources,
    }));
  } catch (error) {
    console.error("Error fetching events for SSR:", error);
    return [];
  }
}

/**
 * Home Page - Server Component
 *
 * Fetches events from Supabase on the server and passes to ClientPage.
 * Benefits:
 * - Faster first contentful paint (events in initial HTML)
 * - Works briefly without JavaScript
 * - Better for SEO (event titles in HTML)
 */
export default async function Home() {
  const events = await getEvents();

  return <ClientPage initialEvents={events} />;
}
