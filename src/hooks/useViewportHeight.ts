"use client";

import { useEffect } from "react";

/**
 * Sets CSS custom properties for viewport height and keyboard offset.
 *
 * --vh: The actual viewport height unit (fixes Safari "chin" problem)
 * --keyboard-offset: The height of the keyboard (for shifting fixed elements up)
 *
 * Key insight: When the keyboard opens on iOS, we DON'T want to shrink --vh
 * (that would cause layout to shrink). Instead, we keep --vh stable and use
 * --keyboard-offset to translate elements up above the keyboard.
 *
 * Usage:
 *   height: calc(var(--vh, 1vh) * 100);
 *   transform: translateY(calc(var(--keyboard-offset, 0px) * -1));
 */
export function useViewportHeight() {
  useEffect(() => {
    // Store the last known "stable" vh (without keyboard)
    let stableVh = window.innerHeight * 0.01;

    function updateViewport() {
      const layoutHeight = window.innerHeight;
      const visualHeight = window.visualViewport?.height ?? layoutHeight;
      const visualOffsetTop = window.visualViewport?.offsetTop ?? 0;

      // Calculate potential keyboard height
      // Keyboard is open when visualViewport is significantly smaller than innerHeight
      const keyboardHeight = layoutHeight - visualHeight - visualOffsetTop;
      const isKeyboardOpen = keyboardHeight > 100; // Keyboards are typically > 200px

      if (isKeyboardOpen) {
        // Keyboard is open - DON'T update --vh (keep it stable)
        // Only update keyboard offset for positioning
        document.documentElement.style.setProperty("--keyboard-offset", `${keyboardHeight}px`);
      } else {
        // No keyboard - update --vh based on visual viewport (fixes Safari chin)
        stableVh = visualHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${stableVh}px`);
        document.documentElement.style.setProperty("--keyboard-offset", "0px");
      }
    }

    // Set initial value
    updateViewport();

    // Update on resize and orientation change
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);

    // Use visualViewport API for keyboard detection (iOS Safari)
    // This fires when the keyboard opens/closes
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewport);
      window.visualViewport.addEventListener("scroll", updateViewport);
    }

    // iOS Safari sometimes needs a delayed update after orientation change
    const handleOrientationChange = () => {
      setTimeout(updateViewport, 100);
    };
    window.addEventListener("orientationchange", handleOrientationChange);

    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      window.removeEventListener("orientationchange", handleOrientationChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewport);
        window.visualViewport.removeEventListener("scroll", updateViewport);
      }
    };
  }, []);
}
