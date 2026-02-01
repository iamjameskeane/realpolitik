import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Entity type icons for display
const ENTITY_ICONS: Record<string, string> = {
  country: "🌍",
  company: "🏢",
  leader: "👤",
  organization: "🏛️",
  alliance: "🤝",
  chokepoint: "🌊",
  facility: "🏭",
  commodity: "📦",
  product: "📱",
  weapon_system: "🚀",
};

// Server-side Supabase client for fetching entity data
function getServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

interface EntityData {
  id: string;
  slug: string;
  node_type: string;
  name: string;
  aliases: string[];
  properties: Record<string, unknown>;
  verified: boolean;
  hit_count: number;
}

async function fetchEntityForSEO(slug: string): Promise<EntityData | null> {
  try {
    const supabase = getServerSupabase();

    // First, try exact slug match
    const { data: bySlug, error: slugError } = await supabase
      .from("entities")
      .select("id, slug, node_type, name, aliases, properties, verified, hit_count")
      .eq("slug", slug)
      .single();

    if (!slugError && bySlug) {
      return bySlug as EntityData;
    }

    // Fallback: try case-insensitive name match (convert slug to name format)
    // e.g., "united-states" -> match "United States" or "united states"
    const nameFromSlug = slug.replace(/-/g, " ");
    const { data: byName, error: nameError } = await supabase
      .from("entities")
      .select("id, slug, node_type, name, aliases, properties, verified, hit_count")
      .ilike("name", nameFromSlug)
      .limit(1)
      .single();

    if (!nameError && byName) {
      return byName as EntityData;
    }

    return null;
  } catch {
    return null;
  }
}

// Fetch recent events for the entity (for description/context)
async function fetchEntityEventCount(entityId: string): Promise<number> {
  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.rpc("get_entity_events", {
      entity_uuid: entityId,
      max_count: 100,
    });

    if (error || !data) return 0;
    return data.length;
  } catch {
    return 0;
  }
}

// Generate dynamic metadata for SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entity = await fetchEntityForSEO(slug);

  if (!entity) {
    return {
      title: "Entity Not Found | Realpolitik",
      description: "This entity could not be found.",
    };
  }

  const icon = ENTITY_ICONS[entity.node_type] || "📍";
  const typeLabel = entity.node_type.replace("_", " ");
  const title = `${icon} ${entity.name} | Realpolitik`;
  const description = `Track geopolitical events involving ${entity.name}. View real-time intelligence updates, analysis, and global impact for this ${typeLabel} on Realpolitik.`;

  return {
    title,
    description,
    openGraph: {
      title: entity.name,
      description,
      type: "profile",
      siteName: "Realpolitik",
    },
    twitter: {
      card: "summary_large_image",
      title: entity.name,
      description,
    },
    alternates: {
      canonical: `https://realpolitik.world/entity/${slug}`,
    },
  };
}

// The page component - renders SEO content and redirects to SPA
export default async function EntityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entity = await fetchEntityForSEO(slug);

  if (!entity) {
    notFound();
  }

  const eventCount = await fetchEntityEventCount(entity.id);
  const icon = ENTITY_ICONS[entity.node_type] || "📍";
  const typeLabel = entity.node_type.replace("_", " ");

  // JSON-LD structured data for Google
  const jsonLd = {
    "@context": "https://schema.org",
    "@type":
      entity.node_type === "country"
        ? "Country"
        : entity.node_type === "company"
          ? "Organization"
          : entity.node_type === "leader"
            ? "Person"
            : "Thing",
    name: entity.name,
    description: `${entity.name} is a ${typeLabel} tracked on Realpolitik with ${eventCount} associated events.`,
    url: `https://realpolitik.world/entity/${slug}`,
    ...(entity.aliases.length > 0 && { alternateName: entity.aliases }),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://realpolitik.world/entity/${slug}`,
    },
    potentialAction: {
      "@type": "ViewAction",
      target: `https://realpolitik.world/?entity=${slug}`,
      name: `View ${entity.name} on Realpolitik Globe`,
    },
  };

  // Render minimal SEO content with JSON-LD, then redirect client-side
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Meta refresh as backup redirect */}
      <meta httpEquiv="refresh" content={`0;url=/?entity=${slug}`} />
      <main className="min-h-screen bg-slate-950 text-white p-8">
        <article className="max-w-2xl mx-auto">
          <header>
            <span className="text-sm uppercase tracking-wide text-slate-400">{typeLabel}</span>
            <h1 className="text-3xl font-bold mt-2 flex items-center gap-3">
              <span className="text-4xl">{icon}</span>
              {entity.name}
            </h1>
            {entity.aliases.length > 0 && (
              <p className="text-slate-400 text-sm mt-2">
                Also known as: {entity.aliases.join(", ")}
              </p>
            )}
          </header>

          <section className="mt-6">
            <div className="flex items-center gap-4 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-cyan-400">{eventCount}</span>
                <span className="text-sm text-slate-400">associated events</span>
              </div>
              {entity.hit_count > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-cyan-400">{entity.hit_count}</span>
                  <span className="text-sm text-slate-400">references</span>
                </div>
              )}
            </div>
          </section>

          <section className="mt-6">
            <p className="text-lg text-slate-300">
              Track real-time geopolitical intelligence involving {entity.name}. View events,
              analysis, and global impact on the interactive Realpolitik globe.
            </p>
          </section>

          <footer className="mt-8 pt-4 border-t border-slate-800">
            <p className="text-slate-400 text-sm mb-4">Redirecting to interactive globe...</p>
            <a href={`/?entity=${slug}`} className="text-cyan-400 hover:text-cyan-300">
              Click here if not redirected →
            </a>
          </footer>
        </article>
      </main>
    </>
  );
}
