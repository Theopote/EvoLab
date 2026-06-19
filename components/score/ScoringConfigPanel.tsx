"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo } from "react";
import type { ProjectDomain, ScoringConfig } from "@/lib/building-domain";
import {
  COMPLIANCE_RULE_FIELDS,
  EGRESS_WIDTH_FIELDS,
  GOAL_WEIGHT_FIELDS,
  PROGRAM_GOALS_PRESET_OPTIONS,
  RULE_PACK_PRESET_OPTIONS,
  SCORING_THRESHOLD_FIELDS,
  createDefaultScoringConfig,
  normalizeScoringConfig,
  previewNormalizedWeights,
  resolveProgramGoalsFromDomain,
  resolveRulePackFromDomain
} from "@/lib/rules/scoring-config";
import { resolveEgressWidthConfig } from "@/lib/compliance-rules";
import type { ProgramGoalWeights, ScoringThresholds } from "@/lib/rules/types";

interface ScoringConfigPanelProps {
  domain: ProjectDomain;
  projectType: string;
  onChange: (patch: Partial<ScoringConfig>) => void;
  onReset: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function ScoringConfigPanel({ domain, projectType, onChange, onReset }: ScoringConfigPanelProps) {
  const config = useMemo(
    () => normalizeScoringConfig(domain.scoringConfig, projectType),
    [domain.scoringConfig, projectType]
  );

  const resolvedRulePack = useMemo(() => resolveRulePackFromDomain(domain, projectType), [domain, projectType]);
  const resolvedGoals = useMemo(() => resolveProgramGoalsFromDomain(domain, projectType), [domain, projectType]);
  const egressDefaults = useMemo(() => resolveEgressWidthConfig(projectType), [projectType]);
  const normalizedWeights = previewNormalizedWeights(resolvedGoals.weights);
  const weightTotal = GOAL_WEIGHT_FIELDS.filter((field) => field.normalized).reduce(
    (total, field) => total + (resolvedGoals.weights[field.key] ?? 0),
    0
  );

  const updateThreshold = (key: keyof ScoringThresholds, rawValue: string, bounds?: { min?: number; max?: number }) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const value = bounds ? clamp(parsed, bounds.min ?? parsed, bounds.max ?? parsed) : parsed;
    onChange({
      scoringThresholds: {
        ...config.scoringThresholds,
        [key]: value
      }
    });
  };

  const updateGoalWeight = (key: keyof ProgramGoalWeights, rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    onChange({
      goalWeights: {
        ...config.goalWeights,
        [key]: parsed
      }
    });
  };

  const updateRuleThreshold = (key: "corridor-width" | "egress-distance" | "stair-count", rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    onChange({
      ruleThresholds: {
        ...config.ruleThresholds,
        [key]: parsed
      }
    });
  };

  const updateEgressWidth = (
    key: "widthPer100PersonsM" | "areaPerOccupantSqm",
    rawValue: string,
    bounds?: { min?: number; max?: number }
  ) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const value = bounds ? clamp(parsed, bounds.min ?? parsed, bounds.max ?? parsed) : parsed;
    onChange({
      egressWidth: {
        ...config.egressWidth,
        [key]: value
      }
    });
  };

  return (
    <section className="rounded border border-line bg-panel/70">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <SlidersHorizontal className="h-4 w-4 text-accent" />
            Rules & scoring weights
          </h3>
          <p className="mt-0.5 text-[11px] text-muted">
            {resolvedRulePack.label} · {resolvedGoals.label} · compliance via {domain.codeContext.label}
          </p>
        </div>
        <button
          className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] text-muted hover:border-accent/40 hover:text-slate-100"
          type="button"
          onClick={onReset}
        >
          <RotateCcw className="h-3 w-3" />
          Reset presets
        </button>
      </header>

      <div className="grid gap-3 p-3 xl:grid-cols-2">
        <div className="space-y-3">
          <PresetGroup
            label="RulePack preset"
            options={RULE_PACK_PRESET_OPTIONS}
            value={config.rulePackPreset ?? createDefaultScoringConfig(projectType).rulePackPreset ?? "healthcare"}
            onSelect={(rulePackPreset) => onChange({ rulePackPreset })}
          />

          <div className="rounded border border-line/80 bg-[#0b1118]/80 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted">Scoring thresholds</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCORING_THRESHOLD_FIELDS.map((field) => {
                const currentValue = config.scoringThresholds?.[field.key] ?? resolvedRulePack.scoring[field.key];

                return (
                  <label className="grid gap-1 text-[11px] text-muted" key={field.key}>
                    <span>{field.label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded border border-line bg-[#0a0f15] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent/60"
                        max={field.max}
                        min={field.min}
                        step={field.step ?? 1}
                        type="number"
                        value={currentValue}
                        onChange={(event) => updateThreshold(field.key, event.target.value, field)}
                      />
                      {field.unit ? <span className="shrink-0 text-[10px]">{field.unit}</span> : null}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-line/80 bg-[#0b1118]/80 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted">Compliance rule thresholds</div>
            <div className="grid gap-2 sm:grid-cols-3">
              {COMPLIANCE_RULE_FIELDS.map((field) => {
                const rule = resolvedRulePack.rules.find((item) => item.id === field.key);
                const currentValue = config.ruleThresholds?.[field.key] ?? rule?.threshold ?? 0;

                return (
                  <label className="grid gap-1 text-[11px] text-muted" key={field.key}>
                    <span>{field.label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded border border-line bg-[#0a0f15] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent/60"
                        step={field.key === "stair-count" ? 1 : 0.1}
                        type="number"
                        value={currentValue}
                        onChange={(event) => updateRuleThreshold(field.key, event.target.value)}
                      />
                      {field.unit ? <span className="shrink-0 text-[10px]">{field.unit}</span> : null}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-line/80 bg-[#0b1118]/80 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted">Building egress width (multi-floor)</div>
            <p className="mb-2 text-[11px] leading-5 text-warning">
              {config.egressWidth?.notice ?? egressDefaults.notice}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {EGRESS_WIDTH_FIELDS.map((field) => {
                const currentValue = config.egressWidth?.[field.key] ?? egressDefaults[field.key];

                return (
                  <label className="grid gap-1 text-[11px] text-muted" key={field.key}>
                    <span>{field.label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-full rounded border border-line bg-[#0a0f15] px-2 py-1 text-sm text-slate-100 outline-none focus:border-accent/60"
                        max={field.max}
                        min={field.min}
                        step={field.step ?? 0.1}
                        type="number"
                        value={currentValue}
                        onChange={(event) => updateEgressWidth(field.key, event.target.value, field)}
                      />
                      {field.unit ? <span className="shrink-0 text-[10px]">{field.unit}</span> : null}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <PresetGroup
            label="ProgramGoals preset"
            options={PROGRAM_GOALS_PRESET_OPTIONS}
            value={config.programGoalsPreset ?? createDefaultScoringConfig(projectType).programGoalsPreset ?? "healthcare"}
            onSelect={(programGoalsPreset) => onChange({ programGoalsPreset })}
          />

          <div className="rounded border border-line/80 bg-[#0b1118]/80 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted">Goal weights</div>
              <div className="text-[10px] text-muted">Raw total {Math.round(weightTotal * 100)}%</div>
            </div>

            <div className="space-y-2">
              {GOAL_WEIGHT_FIELDS.map((field) => {
                const currentValue = resolvedGoals.weights[field.key];
                const normalized = field.normalized ? normalizedWeights[field.key] : undefined;

                return (
                  <label className="grid gap-1" key={field.key}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted">{field.label}</span>
                      <span className="text-slate-200">
                        {field.normalized ? `${Math.round((normalized ?? 0) * 100)}% norm` : `${currentValue} pts`}
                      </span>
                    </div>
                    <input
                      className="w-full accent-accent"
                      max={field.normalized ? 0.5 : 10}
                      min={0}
                      step={field.normalized ? 0.01 : 1}
                      type="range"
                      value={config.goalWeights?.[field.key] ?? currentValue}
                      onChange={(event) => updateGoalWeight(field.key, event.target.value)}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded border border-line/80 bg-[#0b1118]/80 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted">Normalized weight preview</div>
            <div className="space-y-1.5">
              {GOAL_WEIGHT_FIELDS.filter((field) => field.normalized).map((field) => {
                const share = normalizedWeights[field.key] ?? 0;

                return (
                  <div key={field.key}>
                    <div className="mb-0.5 flex justify-between text-[10px] text-muted">
                      <span>{field.label}</span>
                      <span>{Math.round(share * 100)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-white/5">
                      <div className="h-full rounded bg-accent/70" style={{ width: `${share * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PresetGroup<T extends string>({
  label,
  options,
  value,
  onSelect
}: {
  label: string;
  options: Array<{ id: T; label: string; description: string }>;
  value: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="rounded border border-line/80 bg-[#0b1118]/80 p-3">
      <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-2">
        {options.map((option) => (
          <button
            className={`rounded border px-2 py-2 text-left ${
              value === option.id
                ? "border-accent/60 bg-accent/10 text-slate-100"
                : "border-line bg-[#0a0f15] text-muted hover:border-accent/30 hover:text-slate-100"
            }`}
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
          >
            <div className="text-xs font-medium">{option.label}</div>
            <div className="mt-1 text-[10px] leading-4 opacity-80">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
