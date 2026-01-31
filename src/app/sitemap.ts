import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for fetching events
function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://realpolitik.world";

  // Start with static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date("2025-01-01"),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Fetch recent events for dynamic pages
  const supabase = getServerSupabase();
  if (!supabase) {
    return staticPages;
  }

  try {
    // Get events from the last 30 days (high-severity events prioritized)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: events, error } = await supabase
      .from("events_with_reactions")
      .select("id, timestamp, severity")
      .gte("timestamp", thirtyDaysAgo)
      .order("timestamp", { ascending: false })
      .limit(500); // Reasonable limit for sitemap

    if (error || !events) {
      console.error("Sitemap: Failed to fetch events", error);
      return staticPages;
    }

    // Map events to sitemap entries
    const eventPages: MetadataRoute.Sitemap = events.map((event) => ({
      url: `${baseUrl}/event/${event.id}`,
      lastModified: new Date(event.timestamp),
      changeFrequency: "weekly" as const,
      // Higher severity = higher priority (0.5 to 0.8 range)
      priority: Math.min(0.8, 0.5 + (event.severity / 10) * 0.3),
    }));

    return [...staticPages, ...eventPages];
  } catch (error) {
    console.error("Sitemap: Error fetching events", error);
    return staticPages;
  }
}
