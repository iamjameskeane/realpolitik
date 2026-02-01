"use client";

import { motion } from "framer-motion";
import type { Condition, ConditionField, Operator } from "@/types/notifications";
import { FIELD_CONFIGS } from "@/types/notifications";
import { SelectCompact } from "@/components/ui/Select";

interface ConditionRowProps {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
  canRemove: boolean;
  minSeverity?: number; // Minimum allowed severity (tier restriction)
}

const OPERATOR_LABELS: Record<Operator, string> = {
  ">=": "≥",
  "<=": "≤",
  "=": "=",
  "!=": "≠",
  in: "in",
  contains: "contains",
};

export function ConditionRow({
  condition,
  onChange,
  onRemove,
  canRemove,
  minSeverity = 1,
}: ConditionRowProps) {
  const fieldConfig = FIELD_CONFIGS.find((f) => f.field === condition.field);

  const handleFieldChange = (field: ConditionField) => {
    const newConfig = FIELD_CONFIGS.find((f) => f.field === field);
    if (!newConfig) return;

    // Reset operator and value when field changes
    const defaultOperator = newConfig.operators[0];
    let defaultValue: Condition["value"];

    switch (newConfig.type) {
      case "numeric":
        defaultValue = newConfig.min ?? 1;
        break;
      case "select":
        defaultValue = newConfig.options?.[0]?.value ?? "";
        break;
      case "multiselect":
        defaultValue = [];
        break;
      case "text":
        defaultValue = "";
        break;
      default:
        defaultValue = "";
    }

    onChange({
      field,
      operator: defaultOperator,
      value: defaultValue,
    });
  };

  const handleOperatorChange = (operator: Operator) => {
    // Handle switching between single and multi-select
    let newValue = condition.value;
    if (operator === "in" && !Array.isArray(condition.value)) {
      newValue = condition.value ? [String(condition.value)] : [];
    } else if (operator !== "in" && Array.isArray(condition.value)) {
      newValue = condition.value[0] ?? "";
    }
    onChange({ ...condition, operator, value: newValue });
  };

  const handleValueChange = (value: Condition["value"]) => {
    onChange({ ...condition, value });
  };

  // Build field options
  const fieldOptions = FIELD_CONFIGS.map((config) => ({
    value: config.field,
    label: config.label,
  }));

  // Build operator options
  const operatorOptions = (fieldConfig?.operators || []).map((op) => ({
    value: op,
    label: OPERATOR_LABELS[op],
  }));

  const renderValueInput = () => {
    if (!fieldConfig) return null;

    switch (fieldConfig.type) {
      case "numeric": {
        // Apply minSeverity restriction for severity field
        const effectiveMin =
          condition.field === "severity" && minSeverity > (fieldConfig.min ?? 1)
            ? minSeverity
            : fieldConfig.min;
        const isRestricted = condition.field === "severity" && minSeverity > 1;

        return (
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={effectiveMin}
              max={fieldConfig.max}
              value={Number(condition.value)}
              onChange={(e) =>
                handleValueChange(Math.max(effectiveMin ?? 1, Number(e.target.value)))
              }
              className="w-16 rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1.5 text-center text-sm text-slate-100 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            {isRestricted && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-400">
                {minSeverity}+ only
              </span>
            )}
          </div>
        );
      }

      case "select":
        if (condition.operator === "in") {
          // Multi-select chips for "in" operator
          const selectedValues = Array.isArray(condition.value) ? condition.value : [];
          const isEmpty = selectedValues.length === 0;
          return (
            <div className="space-y-1">
              <div
                className={`flex flex-wrap gap-1.5 rounded-lg p-1 ${isEmpty ? "ring-1 ring-red-500/50 bg-red-500/10" : ""}`}
              >
                {fieldConfig.options?.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  // Prevent deselecting the last item
                  const isLastSelected = isSelected && selectedValues.length === 1;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        if (isLastSelected) return; // Can't remove the last one
                        const newValues = isSelected
                          ? selectedValues.filter((v) => v !== opt.value)
                          : [...selectedValues, opt.value];
                        handleValueChange(newValues);
                      }}
                      disabled={isLastSelected}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? isLastSelected
                            ? "bg-cyan-500/70 text-white/80 cursor-not-allowed"
                            : "bg-cyan-500 text-white shadow-sm"
                          : "bg-slate-700/80 text-slate-300 hover:bg-slate-600"
                      }`}
                      title={isLastSelected ? "At least one value required" : undefined}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {isEmpty && <p className="text-[10px] text-red-400">Select at least one value</p>}
            </div>
          );
        }
        // Single select dropdown
        return (
          <SelectCompact
            value={String(condition.value)}
            onChange={(v) => handleValueChange(v)}
            options={fieldConfig.options || []}
          />
        );

      case "text":
        return (
          <input
            type="text"
            value={String(condition.value)}
            onChange={(e) => handleValueChange(e.target.value)}
            placeholder="Enter text..."
            className="min-w-[120px] rounded-lg border border-slate-600 bg-slate-800/80 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-wrap items-center gap-2"
    >
      {/* Field selector */}
      <SelectCompact
        value={condition.field}
        onChange={(v) => handleFieldChange(v as ConditionField)}
        options={fieldOptions}
      />

      {/* Operator selector */}
      <SelectCompact
        value={condition.operator}
        onChange={(v) => handleOperatorChange(v as Operator)}
        options={operatorOptions}
      />

      {/* Value input */}
      {renderValueInput()}

      {/* Remove button */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-red-500/20 hover:text-red-400"
          aria-label="Remove condition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </motion.div>
  );
}
