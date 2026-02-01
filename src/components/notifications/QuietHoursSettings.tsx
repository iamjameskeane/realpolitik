"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { QuietHours } from "@/types/notifications";
import { COMMON_TIMEZONES, DEFAULT_QUIET_HOURS } from "@/types/notifications";
import { SelectCompact } from "@/components/ui/Select";

interface QuietHoursSettingsProps {
  quietHours: QuietHours | undefined;
  onChange: (quietHours: QuietHours) => void;
  disabled?: boolean;
}

// Generate time options in 30-minute increments
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  const time = `${hour.toString().padStart(2, "0")}:${minute}`;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  return {
    value: time,
    label: `${displayHour}:${minute} ${ampm}`,
  };
});

export function QuietHoursSettings({
  quietHours,
  onChange,
  disabled = false,
}: QuietHoursSettingsProps) {
  // Initialize with defaults if not set
  const [localQuietHours, setLocalQuietHours] = useState<QuietHours>(
    quietHours || DEFAULT_QUIET_HOURS
  );

  // Sync with prop changes
  useEffect(() => {
    if (quietHours) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalQuietHours(quietHours);
    }
  }, [quietHours]);

  const handleToggle = () => {
    const updated = { ...localQuietHours, enabled: !localQuietHours.enabled };
    setLocalQuietHours(updated);
    onChange(updated);
  };

  const handleChange = (key: keyof QuietHours, value: string | boolean) => {
    const updated = { ...localQuietHours, [key]: value };
    setLocalQuietHours(updated);
    onChange(updated);
  };

  return (
    <div className={`space-y-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Quiet Hours
          </h4>
          <p className="text-[11px] text-slate-500">Pause notifications during specific hours</p>
        </div>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`relative h-6 w-10 rounded-full transition-colors ${
            localQuietHours.enabled ? "bg-cyan-500" : "bg-slate-600"
          }`}
          role="switch"
          aria-checked={localQuietHours.enabled}
        >
          <motion.span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md"
            animate={{ left: localQuietHours.enabled ? 18 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Settings (only visible when enabled) */}
      <AnimatePresence>
        {localQuietHours.enabled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className=""
          >
            <div className="rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 space-y-3">
              {/* Time Range */}
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">From</label>
                  <SelectCompact
                    value={localQuietHours.start}
                    onChange={(value) => handleChange("start", value)}
                    options={TIME_OPTIONS}
                  />
                </div>
                <div className="mt-4 text-slate-500">→</div>
                <div className="flex-1">
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">To</label>
                  <SelectCompact
                    value={localQuietHours.end}
                    onChange={(value) => handleChange("end", value)}
                    options={TIME_OPTIONS}
                  />
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">
                  Timezone
                </label>
                <SelectCompact
                  value={localQuietHours.timezone}
                  onChange={(value) => handleChange("timezone", value)}
                  options={COMMON_TIMEZONES.map((tz) => ({
                    value: tz.value,
                    label: tz.label,
                  }))}
                />
              </div>

              {/* Preview */}
              <p className="text-[11px] text-slate-500">
                Notifications will be paused from{" "}
                <span className="text-slate-300">
                  {TIME_OPTIONS.find((t) => t.value === localQuietHours.start)?.label}
                </span>{" "}
                to{" "}
                <span className="text-slate-300">
                  {TIME_OPTIONS.find((t) => t.value === localQuietHours.end)?.label}
                </span>{" "}
                in your selected timezone.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
