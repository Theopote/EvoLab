"use client";

import type { PlanScopeKind } from "@/lib/plan-scope";
import { metricsScopeCaption, metricsScopeOptions } from "@/lib/metrics-scope";
import type { PlanVersion } from "@/lib/project-types";

interface MetricsScopeToggleProps {
  version?: PlanVersion;
  activeLevelId?: string;
  scope: PlanScopeKind;
  onScopeChange: (scope: PlanScopeKind) => void;
  compact?: boolean;
}

const scopeLabels: Record<PlanScopeKind, string> = {
  building: "Building",
  level: "Level",
  floor_group: "Group"
};

export function MetricsScopeToggle({
  version,
  activeLevelId,
  scope,
  onScopeChange,
  compact = false
}: MetricsScopeToggleProps) {
  const options = metricsScopeOptions(version, activeLevelId);
  const caption = metricsScopeCaption(version, { scope, levelId: activeLevelId }, activeLevelId);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            className={`rounded border px-2.5 py-1 text-[11px] transition ${
              scope === option.scope
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-line text-muted hover:border-accent/40 hover:text-slate-100"
            } ${option.enabled ? "" : "cursor-not-allowed opacity-40"}`}
            disabled={!option.enabled}
            key={option.scope}
            type="button"
            onClick={() => onScopeChange(option.scope)}
          >
            {scopeLabels[option.scope]}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-5 text-muted">{caption}</p>
    </div>
  );
}
