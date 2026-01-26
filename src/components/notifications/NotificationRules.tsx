"use client";

import { useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import type { NotificationRule } from "@/types/notifications";
import { getRuleSummary, createEmptyRule, RULE_LIMITS } from "@/types/notifications";
import { RuleEditor } from "./RuleEditor";

interface NotificationRulesProps {
  rules: NotificationRule[];
  onRulesChange: (rules: NotificationRule[]) => void;
  disabled?: boolean;
  showPushToggle?: boolean; // Show phone icon to toggle sendPush per rule
}

export function NotificationRules({
  rules,
  onRulesChange,
  disabled = false,
  showPushToggle = false,
}: NotificationRulesProps) {
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const handleToggleRule = (ruleId: string) => {
    const updated = rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r));
    onRulesChange(updated);
  };

  const handleTogglePush = (ruleId: string) => {
    const updated = rules.map((r) => (r.id === ruleId ? { ...r, sendPush: !r.sendPush } : r));
    onRulesChange(updated);
  };

  const handleEditRule = (rule: NotificationRule) => {
    setEditingRule(rule);
    setIsCreatingNew(false);
  };

  const handleCreateRule = () => {
    const newRule = createEmptyRule();
    setEditingRule(newRule);
    setIsCreatingNew(true);
  };

  const handleSaveRule = (savedRule: NotificationRule) => {
    if (isCreatingNew) {
      onRulesChange([...rules, savedRule]);
    } else {
      onRulesChange(rules.map((r) => (r.id === savedRule.id ? savedRule : r)));
    }
    setEditingRule(null);
    setIsCreatingNew(false);
  };

  const handleDeleteRule = (ruleId: string) => {
    onRulesChange(rules.filter((r) => r.id !== ruleId));
    setEditingRule(null);
    setIsCreatingNew(false);
  };

  const handleCancelEdit = () => {
    setEditingRule(null);
    setIsCreatingNew(false);
  };

  const activeRulesCount = rules.filter((r) => r.enabled).length;
  const atRuleLimit = rules.length >= RULE_LIMITS.MAX_RULES;

  return (
    <>
      <div className={`space-y-3 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Alert Rules
            </h4>
            <p className="text-[11px] text-slate-500">
              {activeRulesCount} active rule{activeRulesCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={handleCreateRule}
            disabled={disabled || atRuleLimit}
            title={atRuleLimit ? `Maximum ${RULE_LIMITS.MAX_RULES} rules` : undefined}
            className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-700/50 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-cyan-500 hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Rule {atRuleLimit && `(${RULE_LIMITS.MAX_RULES} max)`}
          </button>
        </div>

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-600 p-4 text-center">
            <p className="text-sm text-slate-400">No rules configured</p>
            <p className="mt-1 text-xs text-slate-500">
              Add a rule to start receiving notifications
            </p>
          </div>
        ) : (
          <Reorder.Group axis="y" values={rules} onReorder={onRulesChange} className="space-y-2">
            <AnimatePresence mode="popLayout">
              {rules.map((rule) => (
                <Reorder.Item
                  key={rule.id}
                  value={rule}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}
                    className={`group rounded-lg border bg-slate-800/50 transition-colors ${
                      rule.enabled ? "border-slate-600" : "border-slate-700/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-3 p-3">
                      {/* Enable toggle */}
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                          rule.enabled
                            ? "border-cyan-500 bg-cyan-500 text-white"
                            : "border-slate-600 bg-transparent text-transparent hover:border-slate-500"
                        }`}
                        aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                      >
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>

                      {/* Rule content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              rule.enabled ? "text-slate-200" : "text-slate-400"
                            }`}
                          >
                            {rule.name}
                          </span>
                          {!rule.enabled && (
                            <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400">
                              paused
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {getRuleSummary(rule)}
                        </p>
                      </div>

                      {/* Push toggle - phone icon */}
                      {showPushToggle && (
                        <button
                          onClick={() => handleTogglePush(rule.id)}
                          className={`flex-shrink-0 rounded-lg p-1.5 transition-all ${
                            rule.sendPush
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "text-slate-500 opacity-60"
                          }`}
                          aria-label={
                            rule.sendPush
                              ? "Disable push for this rule"
                              : "Enable push for this rule"
                          }
                        >
                          <svg
                            className="h-4 w-4"
                            fill={rule.sendPush ? "currentColor" : "none"}
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={rule.sendPush ? 0 : 2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      )}

                      {/* Edit button - always visible for touch devices */}
                      <button
                        onClick={() => handleEditRule(rule)}
                        className="flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition-all hover:bg-slate-700 hover:text-slate-300"
                        aria-label="Edit rule"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>

                      {/* Drag handle - always visible */}
                      <div className="flex-shrink-0 cursor-grab text-slate-600">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="9" cy="6" r="1.5" />
                          <circle cx="15" cy="6" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" />
                          <circle cx="15" cy="12" r="1.5" />
                          <circle cx="9" cy="18" r="1.5" />
                          <circle cx="15" cy="18" r="1.5" />
                        </svg>
                      </div>
                    </div>
                  </motion.div>
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}

        {/* Help text */}
        <p className="text-[11px] text-slate-500">
          Rules are checked in order. An event triggers a notification if it matches any enabled
          rule.
        </p>
      </div>

      {/* Rule Editor Modal */}
      <AnimatePresence>
        {editingRule && (
          <RuleEditor
            rule={editingRule}
            onSave={handleSaveRule}
            onCancel={handleCancelEdit}
            onDelete={isCreatingNew ? undefined : () => handleDeleteRule(editingRule.id)}
            isNew={isCreatingNew}
          />
        )}
      </AnimatePresence>
    </>
  );
}
