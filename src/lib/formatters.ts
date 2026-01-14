/**
 * Shared formatting utilities for Realpolitik
 */

/**
 * Format a relative time string (e.g., "2 min ago", "1 hour ago")
 *
 * @param date - The date to format
 * @param compact - If true, use abbreviated format ("2m ago" vs "2 min ago")
 * @returns Formatted relative time string
 */
export function formatRelativeTime(date: Date, compact = false): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return "just now";

  if (diffMin < 60) {
    return compact ? `${diffMin}m ago` : `${diffMin} min ago`;
  }

  if (diffHour < 24) {
    if (compact) {
      return `${diffHour}h ago`;
    }
    return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
  }

  return date.toLocaleDateString();
}
