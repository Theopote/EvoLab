"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { PlanVersion } from "@/lib/project-types";
import { computeTotalScore } from "@/lib/rules/version-total-score";
import { resolveProgramGoalsFromContext } from "@/lib/rules/program-goals";
import type { ProgramModel } from "@/lib/building-domain";

interface ScoreBreakdownPanelProps {
  version: PlanVersion;
  program?: ProgramModel;
  projectType?: string;
  className?: string;
  compact?: boolean;
}

const impactTone = {
  positive: "text-success",
  negative: "text-warning",
  neutral: "text-muted"
} as const;

export function ScoreBreakdownPanel({ version, program, projectType, className = "", compact = false }: ScoreBreakdownPanelProps) {
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);
  const breakdown = version.scores?.breakdown;
  const totalScore = useMemo(
    () =>
      breakdown?.totalScore ??
      computeTotalScore(
        version.scores ?? {
          areaEfficiency: 0,
          circulationScore: 0,
          daylightScore: 0,
          mepAlignmentScore: 0,
          riskCount: 0
        },
        resolveProgramGoalsFromContext({ program, projectType })
      ),
    [breakdown?.totalScore, program, projectType, version.scores]
  );

  if (!breakdown) {
    return (
      <div className={`rounded border border-line bg-panel/70 p-3 text-xs text-muted ${className}`}>
        Score breakdown is not available for this version yet.
      </div>
    );
  }

  return (
    <section className={`rounded border border-line bg-panel/70 ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div>
          <h3 className="text-sm font-medium text-slate-100">Score breakdown</h3>
          <p className="mt-0.5 text-[11px] text-muted">
            {version.label} · {breakdown.rulePackId} · {breakdown.programGoalsId}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted">Total</div>
          <div className="text-lg font-semibold text-accent">{totalScore}</div>
        </div>
      </header>

      <div className={`grid gap-2 p-3 ${compact ? "" : "lg:grid-cols-2"}`}>
        {breakdown.metrics.map((metric) => {
          const isExpanded = expandedMetricId === metric.id;

          return (
            <article className="rounded border border-line/80 bg-[#0b1118]/80" key={metric.id}>
              <button
                className="flex w-full items-start justify-between gap-3 p-3 text-left"
                type="button"
                onClick={() => setExpandedMetricId(isExpanded ? null : metric.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                    )}
                    <span className="text-sm text-slate-100">{metric.label}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 pl-5 text-[11px] leading-4 text-muted">{metric.summary}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium text-slate-100">{metric.score}</div>
                  <div className="text-[10px] text-muted">w {Math.round(metric.weight * 100)}%</div>
                </div>
              </button>

              {isExpanded ? (
                <div className="border-t border-line/70 px-3 py-2">
                  <ul className="space-y-1.5">
                    {metric.evidence.map((item) => (
                      <li className="flex items-start justify-between gap-3 text-[11px]" key={`${metric.id}-${item.label}`}>
                        <span className="text-muted">{item.label}</span>
                        <span className={impactTone[item.impact ?? "neutral"]}>{item.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {breakdown.comparisonHints.length > 0 ? (
        <footer className="border-t border-line px-3 py-2">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted">Why this score</div>
          <ul className="space-y-1">
            {breakdown.comparisonHints.map((hint) => (
              <li className="text-[11px] leading-4 text-slate-200" key={hint}>
                {hint}
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </section>
  );
}
