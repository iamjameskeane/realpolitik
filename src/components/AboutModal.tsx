"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";

interface AboutModalProps {
  onClose: () => void;
}

/**
 * About Modal - Brutalist Intelligence themed info modal
 * Displays app information, disclaimer, and links
 */
export function AboutModal({ onClose }: AboutModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Focus trap
  useEffect(() => {
    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the modal
    modalRef.current?.focus();

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      // Restore focus when modal closes
      previousActiveElement.current?.focus();
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      {/* Backdrop with blur */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Modal Card */}
      <motion.div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-[450px] rounded-lg border border-slate-700 bg-slate-900 shadow-2xl outline-none"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
          aria-label="Close modal"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header Section */}
        <div className="border-b border-slate-700/50 px-6 py-5">
          <div className="flex items-start gap-2">
            <h2
              id="about-modal-title"
              className="font-mono text-xl font-bold tracking-wider text-slate-100"
            >
              REALPOLITIK
            </h2>
            <span className="rounded bg-red-900/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-red-400">
              v1.0
            </span>
          </div>
          <p className="mt-1 font-mono text-sm tracking-wide text-slate-400">
            Global Situational Awareness
          </p>
        </div>

        {/* Body Section - Scrollable */}
        <div className="custom-scrollbar max-h-[60vh] overflow-y-auto">
          <div className="space-y-5 px-6 py-5">
            {/* Description */}
            <p className="text-sm leading-relaxed text-slate-300">
              Realpolitik aggregates open-source intelligence (OSINT) from global news feeds and
              uses AI to synthesize situation reports.
            </p>

            {/* Disclaimer */}
            <div className="rounded-md border-l-2 border-amber-500/60 bg-amber-900/20 py-3 pl-4 pr-3">
              <p className="text-sm leading-relaxed text-amber-200/90">
                <span className="mr-1.5">⚠️</span>
                <strong className="font-semibold">DISCLAIMER:</strong> Automated analysis. AI models
                can hallucinate or misinterpret context. Always verify reports with primary sources
                before acting.
              </p>
            </div>

            {/* Sources Section */}
            <div className="rounded-md border border-slate-700/50 bg-slate-800/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Intelligence Sources
                </span>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-400">
                Data aggregated from {24} open-source feeds updated every 60 minutes:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "BBC World",
                  "Al Jazeera",
                  "Reuters",
                  "CNN",
                  "NBC News",
                  "Sky News",
                  "The Guardian",
                  "NY Times",
                  "Washington Post",
                  "Deutsche Welle",
                  "France24",
                  "NPR",
                  "Euronews",
                  "SCMP",
                  "Japan Times",
                  "CNA Asia",
                  "Times of Israel",
                  "The Hindu",
                  "Moscow Times",
                  "ABC News",
                  "CBS News",
                  "Breaking Defense",
                  "Foreign Affairs",
                ].map((source) => (
                  <span
                    key={source}
                    className="rounded bg-slate-700/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-400"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>

            {/* Mobile App Section */}
            <div className="rounded-md border border-slate-700/50 bg-slate-800/50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <svg
                  className="h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Install as App
                </span>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-400">
                For the best experience, add Realpolitik to your home screen. You&apos;ll get
                full-screen mode, faster loading, and offline access.
              </p>

              {/* iOS Instructions */}
              <div className="mb-2">
                <div className="mb-1 font-mono text-[10px] font-semibold text-slate-500">
                  iPHONE / iPAD
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Tap{" "}
                  <span className="inline-flex whitespace-nowrap items-center rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">
                    ⋯
                  </span>{" "}
                  →{" "}
                  <span className="inline-flex whitespace-nowrap items-center rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">
                    <svg
                      className="mr-1 h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Share
                  </span>{" "}
                  →{" "}
                  <span className="whitespace-nowrap rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">
                    Add to Home Screen
                  </span>
                </p>
              </div>

              {/* Android Instructions */}
              <div>
                <div className="mb-1 font-mono text-[10px] font-semibold text-slate-500">
                  ANDROID
                </div>
                <p className="text-xs leading-relaxed text-slate-400">
                  Tap{" "}
                  <span className="inline-flex whitespace-nowrap items-center rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">
                    <svg className="mr-1 h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="2" />
                      <circle cx="12" cy="12" r="2" />
                      <circle cx="12" cy="19" r="2" />
                    </svg>
                    Menu
                  </span>{" "}
                  then{" "}
                  <span className="whitespace-nowrap rounded bg-slate-700 px-1.5 py-0.5 text-slate-300">
                    Add to Home Screen
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section - Links */}
        <div className="border-t border-slate-700/50 px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* Feedback Link */}
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLScGAtiNz-mvp6b8c3MZa9tK9Aa8GLsrjRmLIPJOzQ10rNtEbw/viewform"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-emerald-400 transition-colors hover:text-emerald-300"
            >
              📝 FEEDBACK
            </a>

            <span className="text-slate-600">•</span>

            {/* Privacy Link */}
            <a
              href="/privacy"
              className="font-mono text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              PRIVACY
            </a>

            <span className="text-slate-600">•</span>

            {/* Terms Link */}
            <a
              href="/terms"
              className="font-mono text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              TERMS
            </a>

            <span className="text-slate-600">•</span>

            {/* Twitter/X Link */}
            <a
              href="https://x.com/iamjameskeane"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              TWITTER / X ↗
            </a>

            <span className="text-slate-600">•</span>

            {/* LinkedIn Link */}
            <a
              href="https://www.linkedin.com/in/iamjameskeane/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              LINKEDIN ↗
            </a>

            <span className="text-slate-600">•</span>

            {/* GitHub Link */}
            <a
              href="https://github.com/iamjameskeane/realpolitik"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-slate-400 transition-colors hover:text-slate-200"
            >
              GITHUB ↗
            </a>

            <span className="text-slate-600">•</span>

            {/* Ko-Fi Support */}
            <a
              href="https://ko-fi.com/jameskeane"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-amber-900/20 px-3 py-1.5 font-mono text-xs font-medium text-amber-400 transition-colors hover:bg-amber-900/40 hover:text-amber-300"
            >
              SUPPORT ↗
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
