"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { NotificationSettings } from "./NotificationSettings";
import { useAuth } from "@/contexts/AuthContext";

interface SettingsModalProps {
  onClose: () => void;
  is2DMode: boolean;
  onToggle2DMode: () => void;
}

/**
 * Settings Modal - Contains map toggle and notification settings
 */
export function SettingsModal({ onClose, is2DMode, onToggle2DMode }: SettingsModalProps) {
  const { user, profile, session, openAuthModal, signOut, getBriefingUsage } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [briefingLimit, setBriefingLimit] = useState(5);

  // Fetch briefing limit based on tier
  useEffect(() => {
    if (user) {
      getBriefingUsage().then((usage) => {
        if (usage?.limit_value) {
          setBriefingLimit(usage.limit_value);
        }
      });
    }
  }, [user, getBriefingUsage]);

  // Handle upgrade to Pro
  const handleUpgrade = async () => {
    if (!session?.access_token) return;

    setUpgradeLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          returnUrl: window.location.origin,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Failed to create checkout session:", data.error);
      }
    } catch (error) {
      console.error("Upgrade error:", error);
    } finally {
      setUpgradeLoading(false);
    }
  };

  // Handle manage subscription
  const handleManageSubscription = async () => {
    if (!session?.access_token) return;

    setUpgradeLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error("Failed to create portal session:", data.error);
      }
    } catch (error) {
      console.error("Portal error:", error);
    } finally {
      setUpgradeLoading(false);
    }
  };

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
    previousActiveElement.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previousActiveElement.current?.focus();
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
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
          aria-label="Close settings"
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
          <h2
            id="settings-title"
            className="font-mono text-xl font-bold tracking-wider text-slate-100"
          >
            SETTINGS
          </h2>
          <p className="mt-1 font-mono text-sm tracking-wide text-slate-400">
            Configure your experience
          </p>
        </div>

        {/* Content - Scrollable */}
        <div className="custom-scrollbar max-h-[60vh] overflow-y-auto">
          <div className="space-y-5 px-6 py-5">
            {/* User Profile Section */}
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Account
                </span>
              </div>

              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                      {(profile?.display_name || user.email)?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div className="truncate text-sm font-medium text-slate-200">
                        {profile?.display_name || user.email?.split("@")[0]}
                      </div>
                      <div className="truncate text-xs text-slate-400">{user.email}</div>
                    </div>
                  </div>

                  {/* Tier Badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                        profile?.tier === "pro"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-slate-700 text-slate-400"
                      }`}
                    >
                      {profile?.tier || "free"}
                    </span>
                    {profile?.subscription_status === "canceled" &&
                      profile?.subscription_ends_at && (
                        <span className="text-[10px] text-slate-500">
                          ends {new Date(profile.subscription_ends_at).toLocaleDateString()}
                        </span>
                      )}
                  </div>

                  {/* Pythia Usage */}
                  <div className="rounded-md border border-slate-700/30 bg-slate-900/50 px-3 py-2">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-slate-400">
                      Pythia Consultations
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-lg font-bold text-slate-200">
                        {briefingLimit - (profile?.daily_briefings_used || 0)}
                      </span>
                      <span className="text-xs text-slate-400">
                        of {briefingLimit} remaining today
                      </span>
                    </div>
                  </div>

                  {/* Upgrade / Manage Subscription */}
                  {profile?.tier === "free" ? (
                    <div className="space-y-2">
                      {/* Pro Features List */}
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
                        <div className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-400/80">
                          Pro Features
                        </div>
                        <ul className="space-y-1 text-xs text-amber-200/80">
                          <li className="flex items-center gap-1.5">
                            <svg
                              className="h-3 w-3 text-amber-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            50 Pythia consultations/day
                          </li>
                          <li className="flex items-center gap-1.5">
                            <svg
                              className="h-3 w-3 text-amber-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Full fallout analysis
                          </li>
                          <li className="flex items-center gap-1.5">
                            <svg
                              className="h-3 w-3 text-amber-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Custom alert rules
                          </li>
                          <li className="flex items-center gap-1.5">
                            <svg
                              className="h-3 w-3 text-amber-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Smarter AI model
                          </li>
                        </ul>
                      </div>
                      <button
                        onClick={handleUpgrade}
                        disabled={upgradeLoading}
                        className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:from-amber-600 hover:to-orange-600 disabled:opacity-50"
                      >
                        {upgradeLoading ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <>
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                              />
                            </svg>
                            Upgrade to Pro - $5/month
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleManageSubscription}
                      disabled={upgradeLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
                    >
                      {upgradeLoading ? "Loading..." : "Manage Subscription"}
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      await signOut();
                      onClose();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    openAuthModal();
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2.5 transition-all hover:bg-accent/20"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20">
                    <svg
                      className="h-4 w-4 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-accent">Sign In</div>
                    <div className="text-xs text-slate-400">Free • No password needed</div>
                  </div>
                </button>
              )}
            </div>

            {/* Map View Toggle */}
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
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Map View
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {is2DMode ? (
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
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {is2DMode ? "2D Map" : "3D Globe"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {is2DMode ? "Flat projection view" : "Interactive globe view"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onToggle2DMode}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    is2DMode ? "bg-slate-600" : "bg-emerald-500"
                  }`}
                  role="switch"
                  aria-checked={!is2DMode}
                >
                  <motion.span
                    className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md"
                    animate={{ left: is2DMode ? 4 : 24 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>
            </div>

            {/* Push Notifications */}
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
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Notifications
                </span>
              </div>
              <NotificationSettings />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
