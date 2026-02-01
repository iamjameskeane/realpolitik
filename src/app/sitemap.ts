import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for fetching data
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

  // Fetch dynamic content
  const supabase = getServerSupabase();
  if (!supabase) {
    return staticPages;
  }

  try {
    // Fetch events and entities in parallel
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [eventsResult, entitiesResult] = await Promise.all([
      // Get events from the last 30 days (high-severity events prioritized)
      supabase
        .from("events_with_reactions")
        .select("id, timestamp, severity")
        .gte("timestamp", thirtyDaysAgo)
        .order("timestamp", { ascending: false })
        .limit(500),

      // Get verified entities ordered by hit count (most referenced first)
      supabase
        .from("entities")
        .select("slug, hit_count, node_type")
        .eq("verified", true)
        .order("hit_count", { ascending: false })
        .limit(500),
    ]);

    // Process events
    let eventPages: MetadataRoute.Sitemap = [];
    if (!eventsResult.error && eventsResult.data) {
      eventPages = eventsResult.data.map((event) => ({
        url: `${baseUrl}/event/${event.id}`,
        lastModified: new Date(event.timestamp),
        changeFrequency: "weekly" as const,
        // Higher severity = higher priority (0.5 to 0.8 range)
        priority: Math.min(0.8, 0.5 + (event.severity / 10) * 0.3),
      }));
    } else if (eventsResult.error) {
      console.error("Sitemap: Failed to fetch events", eventsResult.error);
    }

    // Process entities
    let entityPages: MetadataRoute.Sitemap = [];
    if (!entitiesResult.error && entitiesResult.data) {
      entityPages = entitiesResult.data.map((entity) => {
        // Higher hit count = higher priority (0.4 to 0.7 range)
        // Countries get a slight boost
        const baseEntityPriority = entity.node_type === "country" ? 0.6 : 0.4;
        const hitBonus = Math.min(0.1, (entity.hit_count / 100) * 0.1);

        return {
          url: `${baseUrl}/entity/${entity.slug}`,
          lastModified: new Date(),
          changeFrequency: "daily" as const,
          priority: Math.min(0.7, baseEntityPriority + hitBonus),
        };
      });
    } else if (entitiesResult.error) {
      console.error("Sitemap: Failed to fetch entities", entitiesResult.error);
    }

    return [...staticPages, ...eventPages, ...entityPages];
  } catch (error) {
    console.error("Sitemap: Error fetching data", error);
    return staticPages;
  }
}
