"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { NotificationRule, Condition } from "@/types/notifications";
import { FIELD_CONFIGS, getRuleSummary, validateRule, RULE_LIMITS } from "@/types/notifications";
import { ConditionRow } from "./ConditionRow";

interface RuleEditorProps {
  rule: NotificationRule;
  onSave: (rule: NotificationRule) => void;
  onCancel: () => void;
  onDelete?: () => void;
  isNew?: boolean;
}

export function RuleEditor({ rule, onSave, onCancel, onDelete, isNew = false }: RuleEditorProps) {
  const [editedRule, setEditedRule] = useState<NotificationRule>({ ...rule });
  const [error, setError] = useState<string | null>(null);

  const updateName = (name: string) => {
    setEditedRule((prev) => ({ ...prev, name }));
    setError(null);
  };

  const updateCondition = useCallback((index: number, condition: Condition) => {
    setEditedRule((prev) => ({
      ...prev,
      conditions: prev.conditions.map((c, i) => (i === index ? condition : c)),
    }));
    setError(null);
  }, []);

  const removeCondition = useCallback((index: number) => {
    setEditedRule((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
    setError(null);
  }, []);

  const atConditionLimit = editedRule.conditions.length >= RULE_LIMITS.MAX_CONDITIONS_PER_RULE;

  const addCondition = () => {
    if (atConditionLimit) return;

    const defaultField = FIELD_CONFIGS[0];
    const newCondition: Condition = {
      field: defaultField.field,
      operator: defaultField.operators[0],
      value: defaultField.type === "numeric" ? (defaultField.min ?? 1) : "",
    };
    setEditedRule((prev) => ({
      ...prev,
      conditions: [...prev.conditions, newCondition],
    }));
  };

  const handleSave = () => {
    const validation = validateRule(editedRule);
    if (!validation.valid) {
      setError(validation.error || "Invalid rule");
      return;
    }
    onSave(editedRule);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Modal */}
      <motion.div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Header */}
        <div className="border-b border-slate-700/50 px-5 py-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-slate-200">
              {isNew ? "Create Rule" : "Edit Rule"}
            </h3>
            <button
              onClick={onCancel}
              className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
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
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {/* Rule Name */}
          <div className="mb-5">
            <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Rule Name
            </label>
            <input
              type="text"
              value={editedRule.name}
              onChange={(e) => updateName(e.target.value)}
              placeholder="e.g., Europe Major Events"
              className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Push Notifications Toggle */}
          <div className="mb-5">
            <button
              type="button"
              onClick={() => setEditedRule((prev) => ({ ...prev, sendPush: !prev.sendPush }))}
              className={`flex w-full items-center gap-3 rounded-lg border p-3 transition-colors ${
                editedRule.sendPush
                  ? "border-cyan-500/50 bg-cyan-500/10"
                  : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
              }`}
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  editedRule.sendPush
                    ? "bg-cyan-500/30 text-cyan-400"
                    : "bg-slate-600 text-slate-400"
                }`}
              >
                <svg
                  className="h-4 w-4"
                  fill={editedRule.sendPush ? "currentColor" : "none"}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={editedRule.sendPush ? 0 : 2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p
                  className={`text-sm font-medium ${editedRule.sendPush ? "text-cyan-400" : "text-slate-300"}`}
                >
                  Push Notifications
                </p>
                <p className="text-xs text-slate-500">
                  {editedRule.sendPush
                    ? "OS-level alerts on devices with push enabled"
                    : "Inbox only, no push alerts"}
                </p>
              </div>
              <div
                className={`h-5 w-9 rounded-full transition-colors ${
                  editedRule.sendPush ? "bg-cyan-500" : "bg-slate-600"
                }`}
              >
                <div
                  className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                    editedRule.sendPush ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Conditions */}
          <div className="mb-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Conditions <span className="text-slate-500">(all must match)</span>
              </label>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {editedRule.conditions.map((condition, index) => (
                  <div key={index}>
                    {index > 0 && (
                      <div className="mb-2 flex items-center gap-2">
                        <div className="h-px flex-1 bg-slate-700" />
                        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-500">
                          AND
                        </span>
                        <div className="h-px flex-1 bg-slate-700" />
                      </div>
                    )}
                    <ConditionRow
                      condition={condition}
                      onChange={(c) => updateCondition(index, c)}
                      onRemove={() => removeCondition(index)}
                      canRemove={editedRule.conditions.length > 1}
                    />
                  </div>
                ))}
              </AnimatePresence>
            </div>

            <button
              onClick={addCondition}
              disabled={atConditionLimit}
              title={
                atConditionLimit
                  ? `Maximum ${RULE_LIMITS.MAX_CONDITIONS_PER_RULE} conditions`
                  : undefined
              }
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-slate-600 px-3 py-2 text-xs text-slate-400 transition-colors hover:border-cyan-500 hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Condition {atConditionLimit && `(${RULE_LIMITS.MAX_CONDITIONS_PER_RULE} max)`}
            </button>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
            <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Rule Summary
            </div>
            <p className="text-sm text-slate-300">
              {editedRule.conditions.length > 0
                ? getRuleSummary(editedRule)
                : "No conditions defined"}
            </p>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-sm text-red-400"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700/50 px-5 py-4">
          <div>
            {onDelete && !isNew && (
              <button
                onClick={onDelete}
                className="rounded-lg px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
              >
                Delete Rule
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg px-4 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
            >
              {isNew ? "Create Rule" : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
