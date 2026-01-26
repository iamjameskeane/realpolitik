"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

export function UserMenu({ className = "" }: { className?: string }) {
  const { user, profile, signOut, getBriefingUsage } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [briefingsRemaining, setBriefingsRemaining] = useState<number | null>(null);

  // Fetch briefing usage when menu opens
  useEffect(() => {
    if (isOpen && user) {
      getBriefingUsage().then((usage) => {
        if (usage) {
          setBriefingsRemaining(usage.remaining);
        }
      });
    }
  }, [isOpen, user, getBriefingUsage]);

  if (!user) return null;

  const displayName = profile?.display_name || user.email?.split("@")[0] || "User";
  const initial = displayName[0].toUpperCase();

  return (
    <div className={`relative ${className}`}>
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="glass-panel flex items-center gap-2 px-3 py-2 transition-all hover:bg-foreground/10"
        title={user.email || undefined}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
          {initial}
        </div>
        <span className="hidden font-mono text-xs text-foreground/70 md:block">{displayName}</span>
        <svg
          className={`h-3 w-3 text-foreground/40 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-lg border border-foreground/10 bg-background/95 shadow-xl backdrop-blur-md"
            >
              {/* User Info */}
              <div className="border-b border-foreground/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
                    {initial}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate text-sm font-medium text-foreground">
                      {displayName}
                    </div>
                    <div className="truncate text-xs text-foreground/50">{user.email}</div>
                  </div>
                </div>
              </div>

              {/* Briefing Usage */}
              <div className="border-b border-foreground/10 px-4 py-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-foreground/50">
                  Briefings Today
                </div>
                <div className="flex items-center justify-between">
                  {briefingsRemaining !== null ? (
                    <>
                      <span className="font-mono text-lg font-bold text-foreground">
                        {briefingsRemaining}
                      </span>
                      <span className="text-xs text-foreground/50">of 10 remaining</span>
                    </>
                  ) : (
                    <div className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
                  )}
                </div>
              </div>

              {/* Account Tier */}
              <div className="border-b border-foreground/10 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground/70">Account</span>
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-foreground/70">
                    {profile?.tier || "Free"}
                  </span>
                </div>
              </div>

              {/* Sign Out */}
              <div className="p-2">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
