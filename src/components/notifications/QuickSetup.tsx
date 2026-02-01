"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { RulePreset, NotificationRule } from "@/types/notifications";
import { RULE_PRESETS } from "@/types/notifications";

interface QuickSetupProps {
  onSelectPreset: (rules: NotificationRule[]) => void;
  onCustomRules: () => void;
}

export function QuickSetup({ onSelectPreset, onCustomRules }: QuickSetupProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
    RULE_PRESETS.find((p) => p.recommended)?.id ?? null
  );

  const handleContinue = () => {
    if (selectedPresetId === "custom") {
      onCustomRules();
    } else {
      const preset = RULE_PRESETS.find((p) => p.id === selectedPresetId);
      if (preset) {
        onSelectPreset(preset.rules);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-1 font-mono text-xs font-bold uppercase tracking-wider text-slate-300">
          Quick Setup
        </h4>
        <p className="text-xs text-slate-500">Start with a preset, customize later</p>
      </div>

      <div className="space-y-2">
        {RULE_PRESETS.map((preset, index) => (
          <motion.button
            key={preset.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedPresetId(preset.id)}
            className={`group relative w-full rounded-lg border p-3 text-left transition-all ${
              selectedPresetId === preset.id
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Radio indicator */}
              <div
                className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  selectedPresetId === preset.id
                    ? "border-cyan-500 bg-cyan-500"
                    : "border-slate-500 bg-transparent"
                }`}
              >
                {selectedPresetId === preset.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-1.5 w-1.5 rounded-full bg-white"
                  />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg" role="img" aria-label={preset.name}>
                    {preset.icon}
                  </span>
                  <span
                    className={`font-medium ${
                      selectedPresetId === preset.id ? "text-cyan-400" : "text-slate-200"
                    }`}
                  >
                    {preset.name}
                  </span>
                  {preset.recommended && (
                    <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-medium text-cyan-400">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{preset.description}</p>
                <p className="mt-1 text-[11px] text-slate-500">{preset.estimatedDaily}</p>
              </div>
            </div>

            {/* Rule preview on hover/selection */}
            {selectedPresetId === preset.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 border-t border-cyan-500/20 pt-2"
              >
                <p className="font-mono text-[10px] uppercase tracking-wider text-cyan-500/70">
                  Rules
                </p>
                {preset.rules.map((rule) => (
                  <p key={rule.id} className="mt-1 text-xs text-slate-400">
                    • {rule.name}:{" "}
                    <span className="text-slate-500">
                      {rule.conditions
                        .map((c) => {
                          const op =
                            c.operator === ">=" ? "≥" : c.operator === "<=" ? "≤" : c.operator;
                          const val = Array.isArray(c.value) ? c.value.join(", ") : c.value;
                          return `${c.field} ${op} ${val}`;
                        })
                        .join(" AND ")}
                    </span>
                  </p>
                ))}
              </motion.div>
            )}
          </motion.button>
        ))}

        {/* Custom option */}
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: RULE_PRESETS.length * 0.05 }}
          onClick={() => setSelectedPresetId("custom")}
          className={`group relative w-full rounded-lg border p-3 text-left transition-all ${
            selectedPresetId === "custom"
              ? "border-cyan-500 bg-cyan-500/10"
              : "border-slate-600 bg-slate-800/50 hover:border-slate-500"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                selectedPresetId === "custom"
                  ? "border-cyan-500 bg-cyan-500"
                  : "border-slate-500 bg-transparent"
              }`}
            >
              {selectedPresetId === "custom" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="h-1.5 w-1.5 rounded-full bg-white"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-lg" role="img" aria-label="Custom">
                  ⚙️
                </span>
                <span
                  className={`font-medium ${
                    selectedPresetId === "custom" ? "text-cyan-400" : "text-slate-200"
                  }`}
                >
                  Custom Rules
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">Build your own with full control</p>
            </div>
          </div>
        </motion.button>
      </div>

      {/* Continue button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={handleContinue}
        disabled={!selectedPresetId}
        className="w-full rounded-lg bg-cyan-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue with{" "}
        {selectedPresetId === "custom"
          ? "Custom Setup"
          : RULE_PRESETS.find((p) => p.id === selectedPresetId)?.name}
      </motion.button>
    </div>
  );
}
