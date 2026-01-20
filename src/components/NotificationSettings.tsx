/**
 * Notification Settings Component
 *
 * Provides UI for:
 * - Enabling/disabling push notifications
 * - Rule-based notification filtering
 * - Quick setup with presets for new users
 * - iOS-specific guidance (add to home screen)
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { NotificationRules, QuickSetup, QuietHoursSettings } from "./notifications";
import type { NotificationRule, QuietHours } from "@/types/notifications";

export function NotificationSettings() {
  const {
    isSupported,
    isStandalone,
    isIOS,
    permission,
    isSubscribed,
    isLoading,
    error,
    preferences,
    isFirstTimeSetup,
    subscribe,
    unsubscribe,
    updateRules,
    updatePreferences,
  } = usePushNotifications();

  const [showQuickSetup, setShowQuickSetup] = useState(false);

  // Show loading state while initializing
  if (isLoading && !isSubscribed) {
    return (
      <div className="animate-pulse rounded-xl bg-slate-800/50 p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-slate-700/50" />
          <div className="flex-1">
            <div className="mb-2 h-4 w-32 rounded bg-slate-700/50" />
            <div className="h-3 w-48 rounded bg-slate-700/50" />
          </div>
        </div>
      </div>
    );
  }

  // iOS not in standalone mode - must add to homescreen (Apple requirement)
  if (isIOS && !isStandalone) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-400">
          <span>📱</span> Add to Home Screen for Notifications
        </h3>
        <p className="mb-3 text-xs text-amber-200/80">
          iOS requires the app to be installed to your home screen for the best
          notification experience.
        </p>
        <div className="space-y-1.5 text-xs text-slate-300/70">
          <p>
            1. Tap <strong>⋯</strong> (more options) in Safari
          </p>
          <p>
            2. Tap <strong>Share</strong> (📤)
          </p>
          <p>
            3. Tap <strong>&quot;Add to Home Screen&quot;</strong>
          </p>
          <p>4. Open Realpolitik from your home screen</p>
          <p>5. Return here to enable notifications</p>
        </div>
      </div>
    );
  }

  // Android not in standalone mode - allow but recommend installing
  const showInstallRecommendation = !isIOS && !isStandalone && isSupported;

  // Not supported at all
  if (!isSupported) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-400">
          <span>❌</span> Notifications Not Available
        </h3>
        <p className="text-xs text-slate-300/70">
          {error || "Your browser does not support push notifications."}
        </p>
      </div>
    );
  }

  // Permission denied
  if (permission === "denied") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-400">
          <span>🔕</span> Notifications Blocked
        </h3>
        <p className="mb-2 text-xs text-slate-300/70">
          You&apos;ve blocked notifications for this site. To enable them:
        </p>
        <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-400">
          <li>Click the lock icon in your browser&apos;s address bar</li>
          <li>Find &quot;Notifications&quot; and change to &quot;Allow&quot;</li>
          <li>Refresh this page</li>
        </ul>
      </div>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      // Show quick setup for first-time users
      if (isFirstTimeSetup) {
        setShowQuickSetup(true);
      } else {
        await subscribe();
      }
    }
  };

  const handlePresetSelect = async (rules: NotificationRule[]) => {
    await subscribe(rules);
    setShowQuickSetup(false);
  };

  const handleCustomRules = async () => {
    // Subscribe with default rule, then show rule editor
    await subscribe();
    setShowQuickSetup(false);
  };

  const handleRulesChange = async (rules: NotificationRule[]) => {
    await updateRules(rules);
  };

  const handleQuietHoursChange = async (quietHours: QuietHours) => {
    await updatePreferences({ quietHours });
  };

  return (
    <div className="space-y-4">
      {/* Install Recommendation for Android in browser */}
      {showInstallRecommendation && !isSubscribed && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
          <p className="text-xs text-blue-300">
            <span className="font-medium">💡 Tip:</span> For the best experience,
            add Realpolitik to your home screen before enabling notifications.
            Tap <strong>⋮</strong> → <strong>&quot;Add to Home Screen&quot;</strong>
          </p>
        </div>
      )}

      {/* Main Toggle */}
      <div className="flex items-center justify-between rounded-xl bg-slate-800/50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/50">
            {isSubscribed ? (
              <svg
                className="h-5 w-5 text-cyan-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-100">Push Notifications</p>
            <p className="text-xs text-slate-400">
              {isSubscribed
                ? `${preferences.rules?.filter((r) => r.enabled).length || 0} active rules`
                : "Get notified when events match your rules"}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative h-7 w-12 rounded-full transition-colors ${
            isSubscribed ? "bg-cyan-500" : "bg-slate-600"
          } ${isLoading ? "cursor-wait opacity-50" : "cursor-pointer"}`}
          role="switch"
          aria-checked={isSubscribed}
        >
          <motion.span
            className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
            animate={{ left: isSubscribed ? 24 : 4 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Setup (for first-time users enabling notifications) */}
      <AnimatePresence>
        {showQuickSetup && !isSubscribed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              <QuickSetup
                onSelectPreset={handlePresetSelect}
                onCustomRules={handleCustomRules}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rule Management (only when subscribed) */}
      <AnimatePresence>
        {isSubscribed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <NotificationRules
                  rules={preferences.rules || []}
                  onRulesChange={handleRulesChange}
                  disabled={isLoading}
                />
              </div>
              
              {/* Quiet Hours */}
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
                <QuietHoursSettings
                  quietHours={preferences.quietHours}
                  onChange={handleQuietHoursChange}
                  disabled={isLoading}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
