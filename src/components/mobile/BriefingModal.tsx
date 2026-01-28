"use client";

import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GeoEvent, CATEGORY_COLORS } from "@/types/events";
import { BriefingChat } from "../briefing";

interface MobileBriefingModalProps {
  event: GeoEvent;
  onClose: () => void;
}

/**
 * Full-screen Pythia modal for mobile.
 * Opens from the bottom with slide animation.
 * Handles keyboard viewport changes.
 */
export function MobileBriefingModal({ event, onClose }: MobileBriefingModalProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track keyboard visibility via visualViewport API
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportResize = () => {
      if (!window.visualViewport) return;

      // Calculate keyboard height
      const viewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      const keyboardOpen = windowHeight - viewportHeight;

      setKeyboardHeight(keyboardOpen > 0 ? keyboardOpen : 0);
    };

    window.visualViewport.addEventListener("resize", handleViewportResize);
    window.visualViewport.addEventListener("scroll", handleViewportResize);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportResize);
      window.visualViewport?.removeEventListener("scroll", handleViewportResize);
    };
  }, []);

  // Close on hardware back button (Android)
  useEffect(() => {
    const handlePopState = () => {
      onClose();
    };

    window.addEventListener("popstate", handlePopState);
    // Push a dummy state to enable back button
    window.history.pushState({ modal: "briefing" }, "");

    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Remove the dummy state
      if (window.history.state?.modal === "briefing") {
        window.history.back();
      }
    };
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const categoryColor = CATEGORY_COLORS[event.category];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex flex-col bg-background"
        style={{
          // Use visualViewport height when keyboard is open, otherwise full height
          height:
            keyboardHeight > 0
              ? `${window.visualViewport?.height || window.innerHeight}px`
              : "calc(var(--vh, 1vh) * 100)",
          paddingTop: "env(safe-area-inset-top, 0px)",
          // Don't add bottom padding when keyboard is open
          paddingBottom: keyboardHeight > 0 ? "0px" : "env(safe-area-inset-bottom, 0px)",
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-foreground/10 p-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ backgroundColor: categoryColor }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                />
              </span>
              <span
                className="font-mono text-xs font-medium uppercase tracking-wide"
                style={{ color: categoryColor }}
              >
                Ask Pythia
              </span>
            </div>
            <h2 className="mt-2 text-base font-semibold leading-snug text-foreground line-clamp-2">
              {event.title}
            </h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-foreground/50">
              {event.location_name && <span>{event.location_name}</span>}
              {event.location_name && <span>•</span>}
              <span>
                {new Date(event.timestamp).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded-full p-2 text-foreground/40 transition-colors active:bg-foreground/10 active:text-foreground"
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

        {/* Chat Interface - takes remaining space */}
        <div className="flex-1 overflow-hidden">
          <BriefingChat event={event} className="h-full" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
