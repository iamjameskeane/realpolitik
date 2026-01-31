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
              Realpolitik is designed with privacy in mind. We collect only the data necessary to
              operate the service and provide you with a personalized experience. We do not sell or
              share personal information with third parties for marketing purposes.
            </p>
          </section>

          {/* User Accounts */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">USER ACCOUNTS</h2>
            <p className="mb-4 leading-relaxed">
              Creating an account enables features like synced preferences, reaction history, and
              push notifications across devices.
            </p>

            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-emerald-400">
                What We Store
              </h3>
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-400">
                <li>
                  <strong className="text-slate-300">Email address:</strong> Used for authentication
                  and account recovery. We may send transactional emails (password reset,
                  verification).
                </li>
                <li>
                  <strong className="text-slate-300">Display name:</strong> Derived from your email
                  by default, or set by you.
                </li>
                <li>
                  <strong className="text-slate-300">Account preferences:</strong> Your notification
                  settings and UI preferences.
                </li>
                <li>
                  <strong className="text-slate-300">Usage data:</strong> Daily briefing count for
                  quota enforcement.
                </li>
                <li>
                  <strong className="text-slate-300">Reactions:</strong> Which events you&apos;ve
                  reacted to (critical, market, noise).
                </li>
                <li>
                  <strong className="text-slate-300">Read state:</strong> Which events you&apos;ve
                  viewed, synced across devices.
                </li>
              </ul>
              <p className="mt-3 text-sm text-slate-500">
                Authentication is handled by{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 underline hover:text-slate-200"
                >
                  Supabase
                </a>
                , which stores your credentials securely with industry-standard encryption.
              </p>
            </div>
          </section>

          {/* Briefings */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              BRIEFINGS (PYTHIA)
            </h2>
            <p className="mb-4 leading-relaxed">
              When you consult Pythia, our AI analyst, your conversations are processed in real-time
              but not stored on our servers.
            </p>

            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-amber-400">
                How Briefings Work
              </h3>
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-400">
                <li>
                  <strong className="text-slate-300">Not stored:</strong> Briefing conversations
                  exist only in your browser session and are cleared when you close the tab.
                </li>
                <li>
                  <strong className="text-slate-300">Processed by AI:</strong> Your questions are
                  sent to Google Gemini along with event context and web search results.
                </li>
                <li>
                  <strong className="text-slate-300">No personal data sent:</strong> We do not send
                  your email, name, or account information to AI providers.
                </li>
              </ul>
            </div>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              THIRD-PARTY SERVICES
            </h2>
            <p className="mb-4 leading-relaxed">
              We use the following third-party services to operate Realpolitik:
            </p>

            {/* Supabase */}
            <div className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-emerald-400">Supabase</h3>
              <p className="mb-3 text-sm leading-relaxed">
                Provides authentication and database services. Stores your account, preferences, and
                application data.
              </p>
              <p className="text-sm text-slate-500">
                See{" "}
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 underline hover:text-slate-200"
                >
                  Supabase Privacy Policy
                </a>
                .
              </p>
            </div>

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

            {/* Google Gemini */}
            <div className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-amber-400">Google Gemini</h3>
              <p className="mb-3 text-sm leading-relaxed">
                Powers Pythia. When you ask a question, we send:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2 text-sm text-slate-400">
                <li>The event title, summary, category, and location</li>
                <li>Your question and recent chat history (current session only)</li>
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
            <div className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-cyan-400">Tavily</h3>
              <p className="mb-3 text-sm leading-relaxed">
                Provides real-time web search for Pythia. When you ask a question, we send:
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

            {/* Stripe */}
            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-violet-400">Stripe</h3>
              <p className="mb-3 text-sm leading-relaxed">
                Processes payments for Pro subscriptions. When you upgrade:
              </p>
              <ul className="list-inside list-disc space-y-1 pl-2 text-sm text-slate-400">
                <li>Payment details are handled entirely by Stripe</li>
                <li>We never see or store your credit card number</li>
                <li>We store only your Stripe customer ID and subscription status</li>
              </ul>
              <p className="mt-3 text-sm text-slate-500">
                See{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 underline hover:text-slate-200"
                >
                  Stripe&apos;s Privacy Policy
                </a>
                .
              </p>
            </div>
          </section>

          {/* Push Notifications */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              PUSH NOTIFICATIONS
            </h2>
            <p className="mb-4 leading-relaxed">
              If you enable push notifications, we store the following linked to your account:
            </p>

            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-indigo-400">
                Push Subscription Data
              </h3>
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-400">
                <li>
                  <strong className="text-slate-300">Endpoint URL:</strong> A unique URL provided by
                  your browser&apos;s push service (Apple, Google, or Mozilla). This is how we send
                  notifications to your device.
                </li>
                <li>
                  <strong className="text-slate-300">Encryption keys:</strong> Public keys used to
                  encrypt notifications so only your browser can decrypt them.
                </li>
                <li>
                  <strong className="text-slate-300">Device name:</strong> Browser and platform info
                  to help you manage multiple devices.
                </li>
                <li>
                  <strong className="text-slate-300">Your preferences:</strong> Severity thresholds
                  and event categories for each device.
                </li>
              </ul>
              <p className="mt-3 text-sm text-slate-500">
                This data is deleted when you unsubscribe, remove the device from your account, or
                when the browser revokes the subscription. Inactive subscriptions are automatically
                cleaned up after 90 days.
              </p>
            </div>
          </section>

          {/* Client-Side Storage */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              CLIENT-SIDE STORAGE
            </h2>
            <p className="mb-4 leading-relaxed">
              We store small amounts of data in your browser to enhance your experience. This data
              never leaves your device unless you&apos;re signed in (then it syncs to your account).
            </p>

            <div className="space-y-3">
              <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <code className="font-mono text-xs text-purple-400">sb-*-auth-token (cookies)</code>
                <p className="mt-2 text-sm text-slate-400">
                  Supabase authentication tokens. Keep you signed in across sessions. These are the
                  only cookies we use, and they are essential for login functionality.
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <code className="font-mono text-xs text-purple-400">realpolitik:readIds</code>
                <p className="mt-2 text-sm text-slate-400">
                  Array of event IDs you&apos;ve clicked on. Shows which events you&apos;ve already
                  viewed. Synced to your account if signed in.
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <code className="font-mono text-xs text-purple-400">realpolitik:lastVisit</code>
                <p className="mt-2 text-sm text-slate-400">
                  Timestamp of your last visit. Used to highlight &quot;new&quot; events. Synced to
                  your account if signed in.
                </p>
              </div>

              <div className="rounded-md border border-slate-800 bg-slate-900/50 p-4">
                <code className="font-mono text-xs text-purple-400">
                  realpolitik:installPromptDismissed
                </code>
                <p className="mt-2 text-sm text-slate-400">
                  Set when you dismiss the &quot;Install App&quot; prompt. Prevents showing it
                  again.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              You can clear this data at any time by clearing your browser&apos;s storage for this
              site, or by signing out and clearing localStorage.
            </p>
          </section>

          {/* What We Don't Collect */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              WHAT WE DON&apos;T COLLECT
            </h2>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>No briefing or chat history is stored on our servers</li>
              <li>No payment card numbers (handled entirely by Stripe)</li>
              <li>No cookies for tracking or advertising</li>
              <li>No cross-site tracking or advertising scripts</li>
              <li>No location data from your device</li>
              <li>No selling or sharing of data with advertisers</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">DATA RETENTION</h2>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>
                <strong className="text-slate-300">Account data:</strong> Retained until you delete
                your account
              </li>
              <li>
                <strong className="text-slate-300">Briefing usage:</strong> Daily counters reset at
                midnight UTC
              </li>
              <li>
                <strong className="text-slate-300">Reactions:</strong> Retained while the event is
                active, deleted when events age out
              </li>
              <li>
                <strong className="text-slate-300">Read history:</strong> Automatically pruned to
                only include recent events
              </li>
              <li>
                <strong className="text-slate-300">Push subscriptions:</strong> Deleted when you
                unsubscribe or after 90 days of inactivity
              </li>
              <li>
                <strong className="text-slate-300">Subscription data:</strong> Stripe retains
                payment history per their policies; we retain subscription status
              </li>
            </ul>
          </section>

          {/* Your Rights */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">YOUR RIGHTS</h2>
            <p className="mb-4 leading-relaxed">You have the right to:</p>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>
                <strong className="text-slate-300">Access your data:</strong> View your profile and
                preferences in the Settings panel
              </li>
              <li>
                <strong className="text-slate-300">Export your data:</strong> Contact us for a full
                export of your account data
              </li>
              <li>
                <strong className="text-slate-300">Delete your account:</strong> Contact us to
                permanently delete your account and all associated data
              </li>
              <li>
                <strong className="text-slate-300">Cancel subscription:</strong> Manage your
                subscription anytime via the Stripe customer portal
              </li>
            </ul>
          </section>

          {/* Contact */}
          <section className="border-t border-slate-800 pt-10">
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">QUESTIONS?</h2>
            <p className="leading-relaxed text-slate-400">
              If you have questions about this privacy policy or want to exercise your data rights,
              reach out on{" "}
              <a
                href="https://x.com/iamjameskeane"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 underline hover:text-slate-100"
              >
                Twitter / X
              </a>{" "}
              or email{" "}
              <a
                href="mailto:realpolitikw@gmail.com"
                className="text-slate-300 underline hover:text-slate-100"
              >
                realpolitikw@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  );
}
