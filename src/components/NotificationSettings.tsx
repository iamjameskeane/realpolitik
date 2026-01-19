/**
 * Notification Settings Component
 *
 * Provides UI for:
 * - Enabling/disabling push notifications
 * - Setting severity threshold
 * - Filtering by category
 * - iOS-specific guidance (add to home screen)
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePushNotifications, PushPreferences } from "@/hooks/usePushNotifications";

const SEVERITY_LABELS: Record<number, string> = {
  1: "All events (1+)",
  3: "Minor+ (3+)",
  5: "Notable+ (5+)",
  6: "Significant+ (6+)",
  7: "Major+ (7+)",
  8: "Critical only (8+)",
  9: "Severe only (9+)",
  10: "Maximum only (10)",
};

const CATEGORIES = [
  { id: "MILITARY", label: "Military", icon: "⚔️" },
  { id: "DIPLOMACY", label: "Diplomacy", icon: "🤝" },
  { id: "ECONOMY", label: "Economy", icon: "📈" },
  { id: "UNREST", label: "Unrest", icon: "🔥" },
] as const;

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
    subscribe,
    unsubscribe,
    updatePreferences,
  } = usePushNotifications();

  // Show loading state while initializing
  if (isLoading && !isSubscribed) {
    return (
      <div className="p-4 rounded-xl bg-slate-800/50 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-slate-700/50" />
          <div className="flex-1">
            <div className="h-4 w-32 rounded bg-slate-700/50 mb-2" />
            <div className="h-3 w-48 rounded bg-slate-700/50" />
          </div>
        </div>
      </div>
    );
  }

  // iOS not in standalone mode - must add to homescreen (Apple requirement)
  if (isIOS && !isStandalone) {
    return (
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
        <h3 className="text-sm font-semibold text-amber-400 mb-2 flex items-center gap-2">
          <span>📱</span> Add to Home Screen for Notifications
        </h3>
        <p className="text-xs text-amber-200/80 mb-3">
          iOS requires the app to be installed to your home screen for the best notification experience.
        </p>
        <div className="space-y-1.5 text-xs text-foreground/70">
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
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
        <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
          <span>❌</span> Notifications Not Available
        </h3>
        <p className="text-xs text-foreground/70">
          {error || "Your browser does not support push notifications."}
        </p>
      </div>
    );
  }

  // Permission denied
  if (permission === "denied") {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
        <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
          <span>🔕</span> Notifications Blocked
        </h3>
        <p className="text-xs text-foreground/70 mb-2">
          You&apos;ve blocked notifications for this site. To enable them:
        </p>
        <ul className="text-xs text-foreground/60 list-disc list-inside space-y-0.5">
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
      await subscribe();
    }
  };

  const handleSeverityChange = async (severity: number) => {
    await updatePreferences({ minSeverity: severity });
  };

  const handleCategoryToggle = async (category: PushPreferences["categories"][number]) => {
    const newCategories = preferences.categories.includes(category)
      ? preferences.categories.filter((c) => c !== category)
      : [...preferences.categories, category];

    // Ensure at least one category is selected
    if (newCategories.length === 0) return;

    await updatePreferences({ categories: newCategories });
  };

  return (
    <div className="space-y-4">
      {/* Install Recommendation for Android in browser */}
      {showInstallRecommendation && !isSubscribed && (
        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
          <p className="text-xs text-blue-300">
            <span className="font-medium">💡 Tip:</span> For the best experience, add Realpolitik to your home screen before enabling notifications.
            Tap <strong>⋮</strong> → <strong>&quot;Add to Home Screen&quot;</strong>
          </p>
        </div>
      )}

      {/* Main Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700/50">
            {isSubscribed ? (
              <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <p className="text-sm font-medium text-foreground">Push Notifications</p>
            <p className="text-xs text-foreground/50">
              {isSubscribed ? "Receiving alerts for significant events" : "Get notified when major events occur"}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`relative h-7 w-12 rounded-full transition-colors ${
            isSubscribed ? "bg-accent" : "bg-slate-600"
          } ${isLoading ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
          role="switch"
          aria-checked={isSubscribed}
        >
          <motion.span
            className="absolute top-1 h-5 w-5 bg-white rounded-full shadow-md"
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
            className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Settings (only when subscribed) */}
      <AnimatePresence>
        {isSubscribed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 overflow-hidden"
          >
            {/* Severity Threshold */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-3">
                Severity Threshold
              </h4>
              <p className="text-xs text-foreground/60 mb-3">
                Only notify for events at or above this severity level
              </p>

              <div className="flex flex-wrap gap-2">
                {[5, 6, 7, 8, 9].map((sev) => (
                  <button
                    key={sev}
                    onClick={() => handleSeverityChange(sev)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      preferences.minSeverity === sev
                        ? "bg-accent text-white"
                        : "bg-slate-700/50 text-foreground/70 hover:bg-slate-700"
                    }`}
                  >
                    {sev}+ {sev >= 8 ? "🔴" : sev >= 6 ? "🟠" : "🟡"}
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-foreground/40 mt-2">{SEVERITY_LABELS[preferences.minSeverity]}</p>
            </div>

            {/* Category Filters */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30">
              <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-3">
                Event Categories
              </h4>
              <p className="text-xs text-foreground/60 mb-3">Select which types of events to be notified about</p>

              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(({ id, label, icon }) => (
                  <button
                    key={id}
                    onClick={() => handleCategoryToggle(id)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      preferences.categories.includes(id)
                        ? "bg-accent text-white"
                        : "bg-slate-700/50 text-foreground/70 hover:bg-slate-700"
                    }`}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
