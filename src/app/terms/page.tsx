import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Realpolitik",
  description: "Terms and conditions for using Realpolitik",
};

export default function TermsPage() {
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
            TERMS OF SERVICE
          </h1>
          <p className="mt-2 font-mono text-sm text-slate-500">Last updated: January 2026</p>
        </header>

        {/* Content */}
        <div className="space-y-10 text-slate-300">
          {/* Introduction */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">1. INTRODUCTION</h2>
            <p className="mb-4 leading-relaxed">
              Welcome to Realpolitik (&quot;the Service&quot;), a geopolitical intelligence platform
              operated by James Keane (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). By
              accessing or using Realpolitik at realpolitik.world, you agree to be bound by these
              Terms of Service (&quot;Terms&quot;).
            </p>
            <p className="leading-relaxed">
              If you do not agree to these Terms, you must not use the Service. We recommend reading
              these Terms in conjunction with our{" "}
              <Link href="/privacy" className="text-slate-100 underline hover:text-white">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          {/* Service Description */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              2. SERVICE DESCRIPTION
            </h2>
            <p className="mb-4 leading-relaxed">Realpolitik provides:</p>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>Aggregated geopolitical news and event monitoring</li>
              <li>AI-powered analysis through Pythia, our AI analyst feature</li>
              <li>Push notifications for significant events</li>
              <li>Community reactions and sentiment indicators</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              The Service aggregates information from third-party sources and uses artificial
              intelligence to provide analysis. We do not create or verify the underlying news
              content.
            </p>
          </section>

          {/* User Accounts */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              3. USER ACCOUNTS
            </h2>
            <p className="mb-4 leading-relaxed">
              To access certain features, you must create an account. When you create an account,
              you agree to:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Accept responsibility for all activity under your account</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Not share your account or create multiple accounts</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              We reserve the right to suspend or terminate accounts that violate these Terms or for
              any other reason at our sole discretion.
            </p>
          </section>

          {/* Subscriptions */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              4. SUBSCRIPTIONS & PAYMENTS
            </h2>

            <div className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-emerald-400">Free Tier</h3>
              <p className="text-sm text-slate-400">
                Basic access with limited daily briefings. No payment required.
              </p>
            </div>

            <div className="mb-6 rounded-md border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="mb-2 font-mono text-sm font-semibold text-amber-400">Pro Tier</h3>
              <p className="mb-3 text-sm text-slate-400">
                Enhanced access with increased briefing limits. Paid monthly subscription.
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-400">
                <li>Billed monthly via Stripe</li>
                <li>Auto-renews until cancelled</li>
                <li>Cancel anytime through your account settings</li>
                <li>Access continues until end of billing period after cancellation</li>
              </ul>
            </div>

            <p className="mb-4 leading-relaxed">
              <strong className="text-slate-100">Refund Policy:</strong> Due to the digital nature
              of the Service, we generally do not offer refunds for subscription payments. However,
              if you experience technical issues that prevent you from using the Service, please
              contact us and we will assess refund requests on a case-by-case basis.
            </p>

            <p className="leading-relaxed">
              <strong className="text-slate-100">Price Changes:</strong> We may change subscription
              prices with 30 days&apos; notice. Continued use after the price change constitutes
              acceptance of the new price.
            </p>
          </section>

          {/* AI Disclaimer */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              5. AI-GENERATED CONTENT DISCLAIMER
            </h2>

            <div className="rounded-md border border-amber-800/50 bg-amber-950/30 p-4">
              <p className="mb-4 font-semibold text-amber-400">IMPORTANT NOTICE</p>
              <p className="mb-4 leading-relaxed text-slate-300">
                Pythia and all AI-generated analysis on Realpolitik is provided for{" "}
                <strong>informational and educational purposes only</strong>. It does not
                constitute:
              </p>
              <ul className="list-inside list-disc space-y-2 text-slate-400">
                <li>Professional intelligence or security advice</li>
                <li>Financial, investment, or trading advice</li>
                <li>Legal advice</li>
                <li>Journalistic reporting or verified news</li>
                <li>Government or official guidance</li>
              </ul>
              <p className="mt-4 leading-relaxed text-slate-300">
                AI-generated content may contain errors, biases, outdated information, or
                inaccuracies. You should independently verify any information before making
                decisions based on it. We accept no liability for actions taken based on
                AI-generated content.
              </p>
            </div>
          </section>

          {/* Content Accuracy */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              6. CONTENT ACCURACY & THIRD-PARTY SOURCES
            </h2>
            <p className="mb-4 leading-relaxed">
              The news and event data displayed on Realpolitik is aggregated from third-party
              sources. We do not:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>Create or author the original news content</li>
              <li>Verify the accuracy of third-party reporting</li>
              <li>Guarantee the completeness or timeliness of information</li>
              <li>Endorse the views expressed in aggregated content</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              The original publishers retain all rights to their content. If you believe content
              infringes your rights, please contact us.
            </p>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              7. ACCEPTABLE USE
            </h2>
            <p className="mb-4 leading-relaxed">You agree not to:</p>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>
                Use automated scripts, bots, or scrapers to access the Service without permission
              </li>
              <li>Resell, redistribute, or commercially exploit the Service or its content</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Circumvent any rate limits or access restrictions</li>
              <li>Impersonate others or misrepresent your affiliation</li>
              <li>Use the Service to harass, abuse, or harm others</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              Violation of these rules may result in immediate termination of your account.
            </p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              8. INTELLECTUAL PROPERTY
            </h2>
            <p className="mb-4 leading-relaxed">
              <strong className="text-slate-100">Our Property:</strong> The Realpolitik platform,
              including its design, code, features, and branding, is owned by us and protected by
              intellectual property laws. You may not copy, modify, or create derivative works
              without permission.
            </p>
            <p className="mb-4 leading-relaxed">
              <strong className="text-slate-100">Your Data:</strong> You retain ownership of your
              account data. By using the Service, you grant us a licence to store and process your
              data as necessary to provide the Service.
            </p>
            <p className="leading-relaxed">
              <strong className="text-slate-100">Third-Party Content:</strong> News articles,
              images, and other third-party content remain the property of their respective owners.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              9. LIMITATION OF LIABILITY
            </h2>
            <p className="mb-4 leading-relaxed">
              To the maximum extent permitted by law, we shall not be liable for:
            </p>
            <ul className="list-inside list-disc space-y-2 text-slate-400">
              <li>Any indirect, incidental, special, or consequential damages</li>
              <li>Loss of profits, data, or business opportunities</li>
              <li>Decisions made or actions taken based on information provided by the Service</li>
              <li>Service interruptions or downtime</li>
              <li>Errors or inaccuracies in AI-generated content</li>
              <li>Actions of third parties or third-party services</li>
            </ul>
            <p className="mt-4 leading-relaxed">
              Our total liability for any claim arising from your use of the Service shall not
              exceed the amount you paid us in the 12 months preceding the claim, or £100, whichever
              is greater.
            </p>
          </section>

          {/* Disclaimer of Warranties */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              10. DISCLAIMER OF WARRANTIES
            </h2>
            <p className="leading-relaxed">
              The Service is provided &quot;as is&quot; and &quot;as available&quot; without
              warranties of any kind, either express or implied, including but not limited to
              warranties of merchantability, fitness for a particular purpose, or non-infringement.
              We do not warrant that the Service will be uninterrupted, error-free, or secure.
            </p>
          </section>

          {/* Service Availability */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              11. SERVICE AVAILABILITY
            </h2>
            <p className="leading-relaxed">
              We strive to maintain high availability but do not guarantee uninterrupted access. We
              may modify, suspend, or discontinue any part of the Service at any time without
              notice. We reserve the right to perform maintenance that may temporarily affect
              availability.
            </p>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              12. CHANGES TO TERMS
            </h2>
            <p className="leading-relaxed">
              We may update these Terms from time to time. We will notify users of material changes
              by updating the &quot;Last updated&quot; date and, where appropriate, providing
              additional notice. Your continued use of the Service after changes constitutes
              acceptance of the updated Terms.
            </p>
          </section>

          {/* Termination */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">13. TERMINATION</h2>
            <p className="mb-4 leading-relaxed">
              <strong className="text-slate-100">By You:</strong> You may stop using the Service and
              delete your account at any time by contacting us. If you have an active subscription,
              you should cancel it first through your account settings.
            </p>
            <p className="leading-relaxed">
              <strong className="text-slate-100">By Us:</strong> We may suspend or terminate your
              access to the Service at any time for violation of these Terms, suspected fraudulent
              activity, or any other reason at our sole discretion. We will make reasonable efforts
              to notify you, except where prohibited by law or where immediate action is necessary.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              14. GOVERNING LAW
            </h2>
            <p className="leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of England
              and Wales. Any disputes arising from these Terms or your use of the Service shall be
              subject to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          {/* Severability */}
          <section>
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">
              15. SEVERABILITY
            </h2>
            <p className="leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that
              provision shall be limited or eliminated to the minimum extent necessary, and the
              remaining provisions shall remain in full force and effect.
            </p>
          </section>

          {/* Contact */}
          <section className="border-t border-slate-800 pt-10">
            <h2 className="mb-4 font-mono text-lg font-semibold text-slate-100">16. CONTACT US</h2>
            <p className="leading-relaxed text-slate-400">
              If you have questions about these Terms, please contact us at{" "}
              <a
                href="mailto:realpolitikw@gmail.com"
                className="text-slate-300 underline hover:text-slate-100"
              >
                realpolitikw@gmail.com
              </a>{" "}
              or reach out on{" "}
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
