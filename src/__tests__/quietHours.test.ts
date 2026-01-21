import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isInQuietHours, QuietHours } from "@/types/notifications";

describe("isInQuietHours", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("disabled quiet hours", () => {
    it("should return false when quietHours is undefined", () => {
      expect(isInQuietHours(undefined)).toBe(false);
    });

    it("should return false when quietHours is disabled", () => {
      const quietHours: QuietHours = {
        enabled: false,
        start: "22:00",
        end: "07:00",
        timezone: "America/New_York",
      };
      expect(isInQuietHours(quietHours)).toBe(false);
    });
  });

  describe("same-day quiet hours (e.g., 14:00 to 16:00)", () => {
    const quietHours: QuietHours = {
      enabled: true,
      start: "14:00",
      end: "16:00",
      timezone: "UTC",
    };

    it("should return true when current time is within range", () => {
      // Set time to 15:00 UTC
      vi.setSystemTime(new Date("2026-01-21T15:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);
    });

    it("should return true at exact start time", () => {
      vi.setSystemTime(new Date("2026-01-21T14:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);
    });

    it("should return false at exact end time", () => {
      vi.setSystemTime(new Date("2026-01-21T16:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });

    it("should return false before start time", () => {
      vi.setSystemTime(new Date("2026-01-21T13:59:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });

    it("should return false after end time", () => {
      vi.setSystemTime(new Date("2026-01-21T16:01:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });
  });

  describe("overnight quiet hours (e.g., 22:00 to 07:00)", () => {
    const quietHours: QuietHours = {
      enabled: true,
      start: "22:00",
      end: "07:00",
      timezone: "UTC",
    };

    it("should return true late at night (23:00)", () => {
      vi.setSystemTime(new Date("2026-01-21T23:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);
    });

    it("should return true at midnight", () => {
      vi.setSystemTime(new Date("2026-01-22T00:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);
    });

    it("should return true early morning (05:00)", () => {
      vi.setSystemTime(new Date("2026-01-22T05:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);
    });

    it("should return true at exact start time (22:00)", () => {
      vi.setSystemTime(new Date("2026-01-21T22:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);
    });

    it("should return false at exact end time (07:00)", () => {
      vi.setSystemTime(new Date("2026-01-22T07:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });

    it("should return false during the day (12:00)", () => {
      vi.setSystemTime(new Date("2026-01-21T12:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });

    it("should return false just before start (21:59)", () => {
      vi.setSystemTime(new Date("2026-01-21T21:59:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });
  });

  describe("timezone handling", () => {
    it("should respect timezone offset (America/New_York)", () => {
      // 22:00 in New York = 03:00 UTC (next day, during EST -5)
      const quietHours: QuietHours = {
        enabled: true,
        start: "22:00",
        end: "07:00",
        timezone: "America/New_York",
      };

      // Set UTC time to 03:00 (which is 22:00 EST the previous day)
      vi.setSystemTime(new Date("2026-01-22T03:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);

      // Set UTC time to 15:00 (which is 10:00 EST - outside quiet hours)
      vi.setSystemTime(new Date("2026-01-22T15:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });

    it("should respect timezone offset (Asia/Tokyo)", () => {
      // Tokyo is UTC+9
      const quietHours: QuietHours = {
        enabled: true,
        start: "22:00",
        end: "07:00",
        timezone: "Asia/Tokyo",
      };

      // 22:00 Tokyo = 13:00 UTC
      vi.setSystemTime(new Date("2026-01-21T13:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);

      // 12:00 Tokyo = 03:00 UTC - outside quiet hours
      vi.setSystemTime(new Date("2026-01-21T03:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });

    it("should handle invalid timezone gracefully", () => {
      const quietHours: QuietHours = {
        enabled: true,
        start: "22:00",
        end: "07:00",
        timezone: "Invalid/Timezone",
      };

      vi.setSystemTime(new Date("2026-01-21T23:00:00Z"));
      // Should return false (fail-safe) when timezone is invalid
      expect(isInQuietHours(quietHours)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle minute precision", () => {
      const quietHours: QuietHours = {
        enabled: true,
        start: "22:30",
        end: "06:45",
        timezone: "UTC",
      };

      // Just before start
      vi.setSystemTime(new Date("2026-01-21T22:29:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);

      // At start
      vi.setSystemTime(new Date("2026-01-21T22:30:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);

      // Just before end
      vi.setSystemTime(new Date("2026-01-22T06:44:00Z"));
      expect(isInQuietHours(quietHours)).toBe(true);

      // At end
      vi.setSystemTime(new Date("2026-01-22T06:45:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });

    it("should handle full 24-hour quiet period (start equals end)", () => {
      const quietHours: QuietHours = {
        enabled: true,
        start: "00:00",
        end: "00:00",
        timezone: "UTC",
      };

      // When start equals end with same-day logic, range is 0
      vi.setSystemTime(new Date("2026-01-21T12:00:00Z"));
      expect(isInQuietHours(quietHours)).toBe(false);
    });
  });
});
