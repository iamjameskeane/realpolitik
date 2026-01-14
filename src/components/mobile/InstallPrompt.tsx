"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA Install Prompt
 *
 * - Android/Chrome: Captures beforeinstallprompt, shows install button
 * - iOS Safari: Shows manual instructions (Add to Home Screen)
 * - Dismissed prompts are remembered for 7 days
 */
export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Check if running as iOS PWA
    if ((navigator as Navigator & { standalone?: boolean }).standalone) {
      return;
    }

    // Check if dismissed recently (7 days)
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        return;
      }
    }

    // Detect iOS
    const isIOSDevice =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

    if (isIOSDevice && isSafari) {
      // Delay showing iOS prompt to not interrupt initial experience
      const timer = setTimeout(() => {
        setIsIOS(true);
        setShowPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay showing to not interrupt initial experience
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
  }, []);

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="fixed inset-x-4 bottom-4 z-[100] md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        <div className="rounded-2xl border border-foreground/10 bg-background/95 p-4 shadow-2xl backdrop-blur-xl">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 text-foreground/40 transition-colors hover:text-foreground"
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

          <div className="flex items-start gap-3">
            {/* App icon */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/20">
              <img src="/logo.svg" alt="" className="h-8 w-8" />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-mono text-sm font-bold text-foreground">Install Realpolitik</h3>
              <p className="mt-0.5 text-xs text-foreground/60">
                {isIOS
                  ? "Add to your home screen for the best experience"
                  : "Install for quick access and fullscreen mode"}
              </p>

              {isIOS ? (
                /* iOS: Manual instructions */
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-foreground/5 p-2">
                  <span className="text-lg">📤</span>
                  <span className="text-xs text-foreground/70">
                    Tap <strong>Share</strong> then{" "}
                    <strong>&ldquo;Add to Home Screen&rdquo;</strong>
                  </span>
                </div>
              ) : (
                /* Android/Chrome: Install button */
                <button
                  onClick={handleInstall}
                  className="mt-3 w-full rounded-lg bg-accent py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-white transition-colors active:bg-accent/80"
                >
                  Install App
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
