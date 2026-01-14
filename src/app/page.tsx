import { ClientPage } from "./ClientPage";
import { GeoEvent } from "@/types/events";

// Events URL for SSR fetch
// In production: Use env var or production URL
// In development: Use localhost
function getEventsUrl(): string {
  if (process.env.NEXT_PUBLIC_EVENTS_URL) {
    return process.env.NEXT_PUBLIC_EVENTS_URL;
  }
  // In development, use localhost; in production, use the domain
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000/events.json";
  }
  return "https://realpolitik.world/events.json";
}

/**
 * Fetch events on the server for SSR
 *
 * This runs at request time (or cached via revalidate).
 * The data is passed to the client and used as SWR's initial data.
 */
async function getEvents(): Promise<GeoEvent[]> {
  try {
    const url = getEventsUrl();
    const response = await fetch(url, {
      next: { revalidate: 60 }, // Cache for 60 seconds on the edge
    });

    if (!response.ok) {
      console.error(`Failed to fetch events: ${response.status}`);
      return [];
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching events for SSR:", error);
    return [];
  }
}

/**
 * Home Page - Server Component
 *
 * Fetches events on the server and passes to ClientPage.
 * Benefits:
 * - Faster first contentful paint (events in initial HTML)
 * - Works briefly without JavaScript
 * - Better for SEO (event titles in HTML)
 */
export default async function Home() {
  const events = await getEvents();

  return <ClientPage initialEvents={events} />;
}
