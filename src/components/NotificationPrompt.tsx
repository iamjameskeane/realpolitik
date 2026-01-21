/**
 * Notification Prompt Component
 * 
 * Shows a friendly banner prompting PWA users to enable notifications.
 * Only shows for:
 * - Mobile users in standalone mode (installed PWA)
 * - Users who haven't subscribed yet
 * - Users who haven't dismissed (dismissing is permanent)
 * 
 * Never shows on desktop.
 * Shows immediately when conditions are met.
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { STORAGE_KEYS } from "@/lib/constants";

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  
  const {
    isSupported,
    isStandalone,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
  } = usePushNotifications();

  useEffect(() => {
    // Wait for push state to load
    if (isLoading) return;

    // Never show on desktop
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android/.test(userAgent);
    if (!isMobile) return;

    // Only show for standalone PWA users who haven't subscribed
    if (!isStandalone) return;
    if (!isSupported) return;
    if (isSubscribed) return;
    if (permission === "denied") return;

    // Check if already dismissed (permanent)
    const dismissed = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PROMPT_DISMISSED);
    if (dismissed) return;

    // Show immediately
    setShowPrompt(true);
  }, [isLoading, isStandalone, isSupported, isSubscribed, permission]);

  // Dismiss permanently - never ask again
  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PROMPT_DISMISSED, "permanent");
  };

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await subscribe();
      setShowPrompt(false);
      // Mark as done so we don't show again even if they unsubscribe later
      localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PROMPT_DISMISSED, "subscribed");
    } catch (error) {
      console.error("Failed to enable notifications:", error);
    } finally {
      setIsEnabling(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 inset-x-0 z-50 mx-auto max-w-md px-4"
      >
        <div className="rounded-2xl bg-gradient-to-br from-indigo-900/95 to-slate-900/95 backdrop-blur-xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 overflow-hidden">
          {/* Content */}
          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Bell icon */}
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white text-sm mb-1">
                  Stay Informed
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Get instant alerts when critical geopolitical events occur worldwide.
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 p-1 rounded-full hover:bg-slate-700/50 transition-colors"
                aria-label="Don't show again"
                title="Don't show again"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleDismiss}
                className="flex-1 py-2 px-3 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
              >
                No thanks
              </button>
              <button
                onClick={handleEnable}
                disabled={isEnabling}
                className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-wait text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {isEnabling ? "Enabling..." : "Enable Notifications"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
