/**
 * Notification Settings Component
 *
 * Two separate systems:
 * 1. NOTIFICATIONS (Inbox) - Events saved based on rules, synced across devices
 * 2. PUSH NOTIFICATIONS - Browser alerts on this device (optional)
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useInboxPreferences } from "@/hooks/useInboxPreferences";
import { NotificationRules, QuickSetup, QuietHoursSettings } from "./notifications";
import type { NotificationRule, QuietHours } from "@/types/notifications";
import { useAuth } from "@/contexts/AuthContext";
import { DeviceList } from "./DeviceList";

export function NotificationSettings() {
  const { user, openAuthModal } = useAuth();

  // Notifications (inbox - synced across devices)
  const {
    preferences: inboxPrefs,
    isLoading: inboxLoading,
    setEnabled: setInboxEnabled,
    updateRules: updateInboxRules,
  } = useInboxPreferences();

  // Push notifications (per-device browser alerts)
  const {
    isSupported: pushSupported,
    isStandalone,
    isIOS,
    permission: pushPermission,
    isSubscribed: pushSubscribed,
    isLoading: pushLoading,
    error: pushError,
    preferences: pushPrefs,
    isFirstTimeSetup,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    updateRules: updatePushRules,
    updatePreferences: updatePushPreferences,
  } = usePushNotifications();

  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"inbox" | "push" | null>("inbox");

  // Gate behind auth
  if (!user) {
    return (
      <button
        onClick={openAuthModal}
        className="flex w-full items-center gap-3 rounded-lg border border-foreground/10 bg-foreground/5 p-4 transition-all hover:border-accent/30 hover:bg-accent/5"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10">
          <svg
            className="h-5 w-5 text-foreground/40"
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
        </div>
        <div className="flex-1 text-left">
          <div className="font-mono text-sm uppercase tracking-wide text-foreground/90">
            Sign in to enable notifications
          </div>
          <div className="text-xs text-foreground/50">Free account • No password needed</div>
        </div>
        <svg
          className="h-4 w-4 text-foreground/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  // Loading state
  if (inboxLoading && pushLoading) {
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

  // Push notification handlers
  const handlePushToggle = async () => {
    if (pushSubscribed) {
      await unsubscribePush();
    } else {
      // If permission is already granted, skip quick setup and just subscribe
      // This handles the case where user previously denied/unsubscribed
      if (pushPermission === "granted") {
        await subscribePush();
      } else if (isFirstTimeSetup) {
        // First time - expand section and show quick setup
        setExpandedSection("push");
        setShowQuickSetup(true);
      } else {
        await subscribePush();
      }
    }
  };

  const handlePresetSelect = async (rules: NotificationRule[]) => {
    await subscribePush(rules);
    setShowQuickSetup(false);
  };

  const handleCustomRules = async () => {
    await subscribePush();
    setShowQuickSetup(false);
  };

  const handleQuietHoursChange = async (quietHours: QuietHours) => {
    await updatePushPreferences({ quietHours });
  };

  // Push support checks
  const pushNotSupported = !pushSupported;
  const pushBlocked = pushPermission === "denied";
  const iosNeedsInstall = isIOS && !isStandalone;
  const canUsePush = !pushNotSupported && !pushBlocked && !iosNeedsInstall;

  return (
    <div className="space-y-3">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* NOTIFICATIONS (INBOX) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
        {/* Header with toggle */}
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setExpandedSection(expandedSection === "inbox" ? null : "inbox")}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/50">
              <svg
                className={`h-5 w-5 ${inboxPrefs.enabled ? "text-violet-400" : "text-slate-400"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Notifications</p>
              <p className="text-xs text-slate-400">
                {inboxPrefs.enabled
                  ? `${inboxPrefs.rules?.filter((r) => r.enabled).length || 0} active rules • Synced`
                  : "Disabled"}
              </p>
            </div>
          </button>

          <button
            onClick={() => setInboxEnabled(!inboxPrefs.enabled)}
            disabled={inboxLoading}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              inboxPrefs.enabled ? "bg-violet-500" : "bg-slate-600"
            } ${inboxLoading ? "cursor-wait opacity-50" : "cursor-pointer"}`}
            role="switch"
            aria-checked={inboxPrefs.enabled}
          >
            <motion.span
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
              animate={{ left: inboxPrefs.enabled ? 24 : 4 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expandedSection === "inbox" && inboxPrefs.enabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-700/50 p-4">
                <p className="mb-4 text-xs text-slate-400">
                  Events matching your rules are saved to your inbox, accessible from the
                  notification dropdown. Synced across all devices.
                </p>
                <NotificationRules
                  rules={inboxPrefs.rules || []}
                  onRulesChange={updateInboxRules}
                  disabled={inboxLoading}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PUSH NOTIFICATIONS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
        {/* Header with toggle */}
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setExpandedSection(expandedSection === "push" ? null : "push")}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/50">
              <svg
                className={`h-5 w-5 ${pushSubscribed ? "text-cyan-400" : "text-slate-400"}`}
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
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Push Notifications</p>
              <p className="text-xs text-slate-400">
                {!canUsePush
                  ? iosNeedsInstall
                    ? "Requires app install"
                    : pushBlocked
                      ? "Blocked by browser"
                      : "Not supported"
                  : pushSubscribed
                    ? `${pushPrefs.rules?.filter((r) => r.enabled).length || 0} active rules • This device`
                    : "Disabled on this device"}
              </p>
            </div>
          </button>

          {canUsePush && (
            <button
              onClick={handlePushToggle}
              disabled={pushLoading}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                pushSubscribed ? "bg-cyan-500" : "bg-slate-600"
              } ${pushLoading ? "cursor-wait opacity-50" : "cursor-pointer"}`}
              role="switch"
              aria-checked={pushSubscribed}
            >
              <motion.span
                className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
                animate={{ left: pushSubscribed ? 24 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          )}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expandedSection === "push" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-700/50 p-4 space-y-4">
                {/* iOS needs install */}
                {iosNeedsInstall && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="mb-2 text-xs font-medium text-amber-400">📱 Add to Home Screen</p>
                    <p className="text-xs text-amber-200/70">
                      iOS requires the app to be installed. Tap Share → Add to Home Screen.
                    </p>
                  </div>
                )}

                {/* Push blocked */}
                {pushBlocked && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                    <p className="mb-2 text-xs font-medium text-red-400">
                      🔕 Notifications Blocked
                    </p>
                    <p className="text-xs text-slate-300/70">
                      Click the lock icon in your address bar → Notifications → Allow
                    </p>
                  </div>
                )}

                {/* Push not supported */}
                {pushNotSupported && !iosNeedsInstall && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-xs text-red-400">
                      Your browser doesn&apos;t support push notifications.
                    </p>
                  </div>
                )}

                {/* Can use push */}
                {canUsePush && (
                  <>
                    <p className="text-xs text-slate-400">
                      Get browser alerts on this device when events match your rules. Each device
                      can have different rules.
                    </p>

                    {/* Error */}
                    {pushError && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                        {pushError}
                      </div>
                    )}

                    {/* Quick Setup */}
                    {showQuickSetup && !pushSubscribed && (
                      <QuickSetup
                        onSelectPreset={handlePresetSelect}
                        onCustomRules={handleCustomRules}
                      />
                    )}

                    {/* Push Rules */}
                    {pushSubscribed && (
                      <>
                        <NotificationRules
                          rules={pushPrefs.rules || []}
                          onRulesChange={updatePushRules}
                          disabled={pushLoading}
                        />

                        <QuietHoursSettings
                          quietHours={pushPrefs.quietHours}
                          onChange={handleQuietHoursChange}
                          disabled={pushLoading}
                        />
                      </>
                    )}

                    {/* Connected Devices */}
                    <div className="pt-2">
                      <h4 className="mb-2 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Your Devices
                      </h4>
                      <DeviceList />
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
