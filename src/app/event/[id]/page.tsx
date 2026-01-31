import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client for fetching event data
function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

interface EventData {
  id: string;
  title: string;
  summary: string;
  category: string;
  severity: number;
  location_name: string;
  region?: string;
  timestamp: string;
  fallout_prediction?: string;
  sources: Array<{
    source_name: string;
    source_url: string;
    headline: string;
  }>;
}

async function fetchEventForSEO(id: string): Promise<EventData | null> {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("events_with_reactions")
      .select(
        "id, title, summary, category, severity, location_name, region, timestamp, fallout_prediction, sources"
      )
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as EventData;
  } catch {
    return null;
  }
}

// Generate dynamic metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchEventForSEO(id);

  if (!event) {
    return {
      title: "Event Not Found | Realpolitik",
      description: "This event could not be found.",
    };
  }

  const categoryEmoji: Record<string, string> = {
    MILITARY: "⚔️",
    DIPLOMACY: "🤝",
    ECONOMY: "📊",
    UNREST: "🔥",
  };

  const emoji = categoryEmoji[event.category] || "🌍";
  const title = `${emoji} ${event.title} | Realpolitik`;
  const description = event.summary.slice(0, 160);

  return {
    title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "article",
      siteName: "Realpolitik",
      publishedTime: event.timestamp,
      tags: [event.category, event.location_name, event.region || ""].filter(Boolean),
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
    },
    alternates: {
      canonical: `https://realpolitik.world/event/${id}`,
    },
  };
}

// The page component - redirects to SPA
export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await fetchEventForSEO(id);

  if (!event) {
    notFound();
  }

  // JSON-LD structured data for Google (injected via metadata)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: event.title,
    description: event.summary,
    datePublished: event.timestamp,
    dateModified: event.timestamp,
    author: {
      "@type": "Organization",
      name: "Realpolitik",
      url: "https://realpolitik.world",
    },
    publisher: {
      "@type": "Organization",
      name: "Realpolitik",
      url: "https://realpolitik.world",
      logo: {
        "@type": "ImageObject",
        url: "https://realpolitik.world/android-chrome-512x512.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://realpolitik.world/event/${id}`,
    },
    about: {
      "@type": "Event",
      name: event.title,
      description: event.summary,
      location: {
        "@type": "Place",
        name: event.location_name,
      },
    },
    keywords: [event.category, event.location_name, "geopolitics", "world events"].join(", "),
  };

  // Render minimal SEO content with JSON-LD, then redirect client-side
  // This ensures Google sees the structured data before redirect
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Meta refresh as backup redirect */}
      <meta httpEquiv="refresh" content={`0;url=/?event=${id}`} />
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <article className="max-w-2xl mx-auto">
          <header>
            <span className="text-sm uppercase tracking-wide text-slate-400">
              {event.category} • {event.location_name}
            </span>
            <h1 className="text-3xl font-bold mt-2">{event.title}</h1>
            <time className="text-slate-400 text-sm">
              {new Date(event.timestamp).toLocaleDateString()}
            </time>
          </header>

          <section className="mt-6">
            <p className="text-lg text-slate-300">{event.summary}</p>
          </section>

          {event.fallout_prediction && (
            <section className="mt-6">
              <h2 className="text-xl font-semibold">Analysis</h2>
              <p className="text-slate-300 mt-2">{event.fallout_prediction}</p>
            </section>
          )}

          <footer className="mt-8 pt-4 border-t border-slate-800">
            <p className="text-slate-400 text-sm mb-4">Redirecting to interactive globe...</p>
            <a href={`/?event=${id}`} className="text-cyan-400 hover:text-cyan-300">
              Click here if not redirected →
            </a>
          </footer>
        </article>
      </main>
    </>
  );
}
