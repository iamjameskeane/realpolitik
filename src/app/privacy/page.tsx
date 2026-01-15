import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Protocol | Realpolitik",
  description: "How Realpolitik handles your data and privacy",
};

export default function PrivacyPage() {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-slate-950 px-4 py-12 md:px-8">
      <article className="mx-auto max-w-2xl">
        {/* Header */}
        <header className="mb-12 border-b border-slate-800 pb-8">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 font-mono text-xs text-slate-500 transition-colors hover:text-slate-300"
          >
            ← RETURN TO DECK
          </Link>
          <h1 className="font-mono text-2xl font-bold tracking-wider text-slate-100 md:text-3xl">
            PRIVACY PROTOCOL
          </h1>
          <p className="mt-2 font-mono text-sm text-slate-500">Last updated: January 2026</p>
        </header>

        {/* Content */}
        <div className="space-y-10 text-slate-300">
          {/* Overview */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">OVERVIEW</h2>
            <p className="leading-relaxed">
              Realpolitik is designed with privacy in mind. We collect minimal data necessary to
              operate the service and do not sell or share personal information with third parties
              for marketing purposes.
            </p>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              THIRD-PARTY SERVICES
            </h2>
            <p className="mb-4 leading-relaxed">
              We use the following third-party services to operate and improve Realpolitik:
            </p>

            {/* Vercel Analytics */}
            <div className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-slate-300">
                Vercel Analytics
              </h3>
              <p className="mb-3 text-sm leading-relaxed">
                Provides privacy-friendly website analytics to help us understand usage patterns.
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2 text-sm text-slate-400">
                <li>Collects anonymous, aggregated page view and visitor data</li>
                <li>Does not use cookies or track individual users across sites</li>
                <li>No personal identifiers are collected</li>
              </ul>
              <p className="mt-3 text-sm text-slate-500">
                See{" "}
                <a
                  href="https://vercel.com/docs/analytics/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 underline hover:text-slate-200"
                >
                  Vercel Analytics Privacy Policy
                </a>
                .
              </p>
            </div>

            <p className="mb-4 leading-relaxed">
              When you use the AI Briefing feature, we also send data to:
            </p>

            {/* Google Gemini */}
            <div className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-amber-400">Google Gemini</h3>
              <p className="mb-3 text-sm leading-relaxed">
                Powers the AI Briefing chat. When you ask a question, we send:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2 text-sm text-slate-400">
                <li>The event title, summary, category, and location</li>
                <li>Your question and recent chat history (last 5 exchanges)</li>
                <li>Search results from Tavily related to your question</li>
              </ul>
              <p className="mt-3 text-sm text-slate-500">
                No personal identifiers are sent. See{" "}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 underline hover:text-slate-200"
                >
                  Google&apos;s Privacy Policy
                </a>
                .
              </p>
            </div>

            {/* Tavily */}
            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-cyan-400">Tavily</h3>
              <p className="mb-3 text-sm leading-relaxed">
                Provides real-time web search for AI Briefings. When you ask a question, we send:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2 text-sm text-slate-400">
                <li>A search query combining the event title and your question</li>
              </ul>
              <p className="mt-3 text-sm text-slate-500">
                No personal identifiers are sent. See{" "}
                <a
                  href="https://tavily.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 underline hover:text-slate-200"
                >
                  Tavily&apos;s Privacy Policy
                </a>
                .
              </p>
            </div>
          </section>

          {/* IP Address Usage */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              IP ADDRESS USAGE
            </h2>
            <p className="mb-4 leading-relaxed">
              We use your IP address for rate limiting to prevent abuse and ensure fair usage of the
              AI Briefing feature.
            </p>
            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-emerald-400">
                How We Handle Your IP
              </h3>
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-400">
                <li>
                  <strong className="text-slate-300">Hashed, not stored raw:</strong> Your IP is
                  immediately hashed using SHA-256 with a secret salt. Only a truncated hash (16
                  characters) is stored.
                </li>
                <li>
                  <strong className="text-slate-300">Purpose:</strong> Daily briefing limits (to
                  control API costs) and tracking your reaction votes on events.
                </li>
                <li>
                  <strong className="text-slate-300">Not reversible:</strong> The hash cannot be
                  reversed to reveal your actual IP address.
                </li>
                <li>
                  <strong className="text-slate-300">Storage:</strong> Hashed identifiers are stored
                  in Upstash Redis and automatically expire after 24 hours (for rate limits) or when
                  events age out.
                </li>
                <li>
                  <strong className="text-slate-300">Session tokens:</strong> When using AI
                  Briefings, a session token is generated and stored for 1 hour to reduce repeated
                  verification. This token is tied to your hashed IP and expires automatically.
                </li>
              </ul>
            </div>
          </section>

          {/* Client-Side Storage */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              CLIENT-SIDE STORAGE
            </h2>
            <p className="mb-4 leading-relaxed">
              We store small amounts of data in your browser&apos;s localStorage to enhance your
              experience. This data never leaves your device.
            </p>

            <div className="space-y-3">
              <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <code className="font-mono text-xs text-purple-400">realpolitik:readIds</code>
                <p className="mt-2 text-sm text-slate-400">
                  Array of event IDs you&apos;ve clicked on. Used to show which events you&apos;ve
                  already viewed (visual &quot;read&quot; state). Pruned automatically to only
                  include current events.
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <code className="font-mono text-xs text-purple-400">realpolitik:lastVisit</code>
                <p className="mt-2 text-sm text-slate-400">
                  Timestamp of your last visit. Used to determine which events are &quot;new&quot;
                  since you last checked.
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <code className="font-mono text-xs text-purple-400">pwa-prompt-dismissed</code>
                <p className="mt-2 text-sm text-slate-400">
                  Timestamp when you dismissed the &quot;Add to Home Screen&quot; prompt. Prevents
                  showing the prompt again.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              You can clear this data at any time by clearing your browser&apos;s localStorage for
              this site, or by visiting the app with{" "}
              <code className="text-slate-400">?reset=1</code> in the URL.
            </p>
          </section>

          {/* What We Don't Collect */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              WHAT WE DON&apos;T COLLECT
            </h2>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>No account registration or personal information required</li>
              <li>No email addresses or names</li>
              <li>No cookies for tracking or advertising</li>
              <li>No cross-site tracking or advertising scripts</li>
              <li>No location data from your device</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">DATA RETENTION</h2>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>
                <strong className="text-slate-300">Rate limit counters:</strong> Expire
                automatically at midnight UTC each day
              </li>
              <li>
                <strong className="text-slate-300">Reaction votes:</strong> Retained while the event
                is active, deleted when events age out of the system
              </li>
              <li>
                <strong className="text-slate-300">Client-side data:</strong> Persists until you
                clear it or the browser clears localStorage
              </li>
            </ul>
          </section>

          {/* Contact */}
          <section className="border-t border-slate-800 pt-10">
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">QUESTIONS?</h2>
            <p className="leading-relaxed text-slate-400">
              If you have questions about this privacy policy, reach out on{" "}
              <a
                href="https://x.com/iamjameskeane"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 underline hover:text-slate-100"
              >
                Twitter / X
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
