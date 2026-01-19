/**
 * Install Prompt Component
 *
 * Prompts mobile users to add the app to their home screen.
 * - Shows after 30 seconds of use
 * - "Maybe later" closes popup but shows again next session
 * - X button permanently dismisses
 * - Android: Uses native install prompt if available
 * - iOS: Shows manual instructions
 * - Never shows on desktop
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STORAGE_KEYS } from "@/lib/constants";

const PROMPT_DELAY_MS = 30000; // Show after 30 seconds

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  // Check if permanently dismissed
  const isPermanentlyDismissed = useCallback(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED) === "permanent";
  }, []);

  // Check if we should show the prompt
  const shouldShowPrompt = useCallback(() => {
    if (typeof window === "undefined") return false;

    // Never show if permanently dismissed
    if (isPermanentlyDismissed()) return false;

    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return false;

    // Never show on desktop
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(userAgent);
    if (!isMobile) return false;

    return true;
  }, [isPermanentlyDismissed]);

  useEffect(() => {
    // Early exit if shouldn't show
    if (!shouldShowPrompt()) return;

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Listen for Android's beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Show prompt after 30 seconds
    const timer = setTimeout(() => {
      if (shouldShowPrompt()) {
        setShowPrompt(true);
      }
    }, PROMPT_DELAY_MS);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, [shouldShowPrompt]);

  // "Maybe later" - just close, will show again next session
  const handleMaybeLater = () => {
    setShowPrompt(false);
  };

  // X button - permanently dismiss
  const handlePermanentDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, "permanent");
  };

  // Install button (Android native prompt)
  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPrompt(false);
        // Mark as done so we don't show again
        localStorage.setItem(STORAGE_KEYS.INSTALL_PROMPT_DISMISSED, "permanent");
      }
      setDeferredPrompt(null);
    }
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 inset-x-0 z-50 mx-auto max-w-md px-4"
      >
        <div className="rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📲</span>
                <h3 className="font-semibold text-white">Install Realpolitik</h3>
              </div>
              <button
                onClick={handlePermanentDismiss}
                className="p-1 rounded-full hover:bg-slate-700/50 transition-colors"
                aria-label="Never show again"
                title="Don't show again"
              >
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-sm text-slate-300 mb-4">
              Add Realpolitik to your home screen for the best experience:
            </p>

            <ul className="space-y-2 text-sm text-slate-400 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Instant access from your home screen</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Push notifications for breaking events</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Full-screen immersive experience</span>
              </li>
            </ul>

            {isIOS ? (
              // iOS Instructions
              <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-400 mb-2">In Safari:</p>
                <div className="flex flex-col gap-1.5 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">1.</span>
                    <span>Tap</span>
                    <span className="font-mono text-lg">⋯</span>
                    <span className="text-slate-400">(more options)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">2.</span>
                    <span>Tap</span>
                    <span className="text-lg">📤</span>
                    <span className="text-slate-400">Share</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">3.</span>
                    <span className="font-medium">&quot;Add to Home Screen&quot;</span>
                  </div>
                </div>
              </div>
            ) : isAndroid && deferredPrompt ? (
              // Android with native prompt available
              <button
                onClick={handleInstall}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors mb-2"
              >
                Install App
              </button>
            ) : (
              // Android without native prompt (or other browsers)
              <div className="bg-slate-800/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-400 mb-2">In Chrome:</p>
                <div className="flex flex-col gap-1.5 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">1.</span>
                    <span>Tap</span>
                    <span className="font-mono text-lg">⋮</span>
                    <span className="text-slate-400">(menu)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">2.</span>
                    <span className="font-medium">&quot;Add to Home Screen&quot;</span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleMaybeLater}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
