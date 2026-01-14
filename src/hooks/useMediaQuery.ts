"use client";

import { useSyncExternalStore, useCallback } from "react";

/**
 * Hook to detect if a media query matches.
 * Uses useSyncExternalStore for proper SSR handling.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", callback);
      return () => mediaQuery.removeEventListener("change", callback);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => {
    // Return false on server to avoid hydration mismatch
    return false;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Hook to detect mobile screen width.
 * Uses window.innerWidth with resize listener for more reliable detection.
 */
export function useIsMobile(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener("resize", callback);
    return () => window.removeEventListener("resize", callback);
  }, []);

  const getSnapshot = useCallback(() => {
    return window.innerWidth < 768;
  }, []);

  const getServerSnapshot = useCallback(() => {
    // Return false on server to avoid hydration mismatch
    return false;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
