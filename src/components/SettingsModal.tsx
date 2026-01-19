"use client";

import { useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { NotificationSettings } from "./NotificationSettings";

interface SettingsModalProps {
  onClose: () => void;
  is2DMode: boolean;
  onToggle2DMode: () => void;
}

/**
 * Settings Modal - Contains map toggle and notification settings
 */
export function SettingsModal({ onClose, is2DMode, onToggle2DMode }: SettingsModalProps) {
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
