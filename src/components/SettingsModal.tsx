"use client";

import { useEffect, useCallback } from "react";
import { NotificationSettings } from "./NotificationSettings";

interface SettingsModalProps {
  onClose: () => void;
  is2DMode: boolean;
  onToggle2DMode: () => void;
}

/**
 * Settings Modal - Contains map toggle
 */
export function SettingsModal({ onClose, is2DMode, onToggle2DMode }: SettingsModalProps) {
  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="relative mx-4 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
        {/* Card */}
        <div className="rounded-2xl bg-slate-900 border border-slate-700/50 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-4">
            <h2
              id="settings-title"
              className="font-mono text-sm font-bold uppercase tracking-widest text-foreground"
            >
              Settings
            </h2>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/50 transition-colors hover:bg-foreground/10 hover:text-foreground"
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
          </div>

          {/* Content */}
          <div className="p-5 space-y-6">
            {/* Map View Toggle */}
            <div>
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-3">
                Map View
              </h3>
              <div className="flex items-center justify-between rounded-xl bg-slate-800/50 p-4">
                <div className="flex items-center gap-3">
                  {is2DMode ? (
                    <svg
                      className="h-5 w-5 text-foreground/60"
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
                      className="h-5 w-5 text-accent"
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
                    <p className="text-sm font-medium text-foreground">
                      {is2DMode ? "2D Map" : "3D Globe"}
                    </p>
                    <p className="text-xs text-foreground/50">
                      {is2DMode ? "Flat projection view" : "Interactive globe view"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onToggle2DMode}
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    is2DMode ? "bg-slate-600" : "bg-accent"
                  }`}
                  role="switch"
                  aria-checked={!is2DMode}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                      is2DMode ? "left-1" : "left-6"
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Push Notifications */}
            <div>
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground/50 mb-3">
                Notifications
              </h3>
              <NotificationSettings />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
