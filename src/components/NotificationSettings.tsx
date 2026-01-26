/**
 * Notification Settings Component
 *
 * Four distinct sections:
 * 1. NOTIFICATIONS - Master toggle for the whole system
 * 2. PUSH NOTIFICATIONS - Device-level OS alerts toggle with quiet hours
 * 3. RULES - Unified rules list with per-rule push toggles
 * 4. DEVICES - Connected devices list
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
    isSaving: inboxSaving,
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
    updatePreferences: updatePushPreferences,
  } = usePushNotifications();

  const [showQuickSetup, setShowQuickSetup] = useState(false);

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
    // Can't enable push without inbox enabled
    if (!inboxPrefs.enabled) return;

    if (pushSubscribed) {
      await unsubscribePush();
    } else if (pushPermission === "granted") {
      await subscribePush();
    } else if (isFirstTimeSetup) {
      setShowQuickSetup(true);
    } else {
      await subscribePush();
    }
  };

  const handlePresetSelect = async (rules: NotificationRule[]) => {
    // When using quick setup, set those rules as inbox rules with sendPush enabled
    await updateInboxRules(rules.map((r) => ({ ...r, sendPush: true })));
    await subscribePush();
    setShowQuickSetup(false);
  };

  const handleCustomRules = async () => {
    await subscribePush();
    setShowQuickSetup(false);
  };

  const handleQuietHoursChange = async (quietHours: QuietHours) => {
    await updatePushPreferences({ quietHours });
  };

  // Count rules
  const pushEnabledRules = inboxPrefs.rules?.filter((r) => r.enabled && r.sendPush).length || 0;
  const activeRules = inboxPrefs.rules?.filter((r) => r.enabled).length || 0;

  // Push support checks
  const pushNotSupported = !pushSupported;
  const pushBlocked = pushPermission === "denied";
  const iosNeedsInstall = isIOS && !isStandalone;
  const canUsePush = !pushNotSupported && !pushBlocked && !iosNeedsInstall;

  return (
    <div className="space-y-3">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: NOTIFICATIONS - Master toggle */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-1 items-center gap-3">
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-100">Notifications</p>
              <p className="text-xs text-slate-400">
                {inboxPrefs.enabled ? "Events saved to your inbox" : "Disabled"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setInboxEnabled(!inboxPrefs.enabled)}
            disabled={inboxLoading || inboxSaving}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              inboxPrefs.enabled ? "bg-violet-500" : "bg-slate-600"
            } ${inboxLoading || inboxSaving ? "cursor-wait opacity-50" : "cursor-pointer"}`}
            role="switch"
            aria-checked={inboxPrefs.enabled}
          >
            {inboxSaving ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              </span>
            ) : (
              <motion.span
                className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
                animate={{ left: inboxPrefs.enabled ? 24 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: PUSH NOTIFICATIONS - Device toggle with quiet hours */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex flex-1 items-center gap-3">
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
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
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
                  : !inboxPrefs.enabled
                    ? "Enable notifications first"
                    : pushSubscribed
                      ? "OS-level alerts enabled"
                      : "OS-level alerts disabled"}
              </p>
            </div>
          </div>

          {canUsePush && (
            <button
              onClick={handlePushToggle}
              disabled={pushLoading || !inboxPrefs.enabled}
              title={!inboxPrefs.enabled ? "Enable notifications first" : undefined}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                pushSubscribed ? "bg-cyan-500" : "bg-slate-600"
              } ${pushLoading || !inboxPrefs.enabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
              role="switch"
              aria-checked={pushSubscribed}
            >
              {pushLoading ? (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                </span>
              ) : (
                <motion.span
                  className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
                  animate={{ left: pushSubscribed ? 24 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          )}
        </div>

        {/* Nested: Quiet Hours (only when push subscribed) */}
        <AnimatePresence>
          {pushSubscribed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-700/50 p-4 space-y-4">
                {/* Error */}
                {pushError && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                    {pushError}
                  </div>
                )}

                {/* Quick Setup for first time */}
                {showQuickSetup && (
                  <QuickSetup
                    onSelectPreset={handlePresetSelect}
                    onCustomRules={handleCustomRules}
                  />
                )}

                {/* Quiet Hours */}
                <QuietHoursSettings
                  quietHours={pushPrefs.quietHours}
                  onChange={handleQuietHoursChange}
                  disabled={pushLoading}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show warnings when not subscribed */}
        {!pushSubscribed && (
          <AnimatePresence>
            {(iosNeedsInstall || pushBlocked || (pushNotSupported && !iosNeedsInstall)) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-slate-700/50 p-4">
                  {iosNeedsInstall && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-xs text-amber-200/70">
                        iOS requires the app to be installed. Tap Share → Add to Home Screen.
                      </p>
                    </div>
                  )}

                  {pushBlocked && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <p className="text-xs text-slate-300/70">
                        Notifications blocked. Click the lock icon in your address bar →
                        Notifications → Allow
                      </p>
                    </div>
                  )}

                  {pushNotSupported && !iosNeedsInstall && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                      <p className="text-xs text-red-400">
                        Your browser doesn&apos;t support push notifications.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 3: RULES - Only shown when notifications enabled */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {inboxPrefs.enabled && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <NotificationRules
            rules={inboxPrefs.rules || []}
            onRulesChange={updateInboxRules}
            disabled={inboxLoading || inboxSaving}
            showPushToggle={pushSubscribed}
          />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECTION 4: DEVICES - Show when notifications enabled */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {inboxPrefs.enabled && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
          <h4 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-400">
            Your Devices
          </h4>
          <DeviceList />
        </div>
      )}
    </div>
  );
}
