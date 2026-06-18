"use client";

import type { PlanVersion } from "@/lib/project-types";
import type { ProgramModel } from "@/lib/building-domain";
import { compareVersionScores, computeTotalScore } from "@/lib/rules/version-total-score";
import { resolveProgramGoals } from "@/lib/rules/program-goals";

interface VersionCompareExplainPanelProps {
  left: PlanVersion;
  right: PlanVersion;
  program?: ProgramModel;
  leftLabel?: string;
  rightLabel?: string;
}

const emptyScores = {
  areaEfficiency: 0,
  circulationScore: 0,
  daylightScore: 0,
  mepAlignmentScore: 0,
  riskCount: 0
};

export function VersionCompareExplainPanel({
  left,
  right,
  program,
  leftLabel,
  rightLabel
}: VersionCompareExplainPanelProps) {
  const goals = resolveProgramGoals(program);
  const leftScores = left.scores ?? emptyScores;
  const rightScores = right.scores ?? emptyScores;
  const leftTotal = computeTotalScore(leftScores, goals);
  const rightTotal = computeTotalScore(rightScores, goals);
  const comparison = compareVersionScores(leftScores, rightScores, goals);
  const recommended = leftTotal >= rightTotal ? "left" : "right";
  const winner = recommended === "left" ? left : right;
  const loser = recommended === "left" ? right : left;
  const winnerLabel = recommended === "left" ? leftLabel ?? left.label : rightLabel ?? right.label;
  const loserLabel = recommended === "left" ? rightLabel ?? right.label : leftLabel ?? left.label;

  return (
    <section className="rounded border border-line bg-panel/90 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Why recommend {winnerLabel}</h3>
          <p className="mt-1 text-xs text-muted">
            {winnerLabel} {leftTotal === rightTotal ? "ties" : "leads"} {loserLabel} by{" "}
            {Math.abs(leftTotal - rightTotal)} points ({leftTotal} vs {rightTotal}).
          </p>
        </div>
        <div className="rounded border border-accent/40 bg-accent/10 px-2 py-1 text-[11px] text-accent">
          Recommended: {winner.label}
        </div>
      </div>

      {comparison.explanations.length > 0 ? (
        <ul className="space-y-2">
          {comparison.explanations.map((explanation) => (
            <li className="rounded border border-line/70 bg-[#0b1118] px-3 py-2 text-xs leading-5 text-slate-200" key={explanation}>
              {explanation}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Both options score similarly across weighted metrics.</p>
      )}

      {winner.scores?.breakdown?.comparisonHints.length ? (
        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-1 text-[10px] uppercase tracking-[0.12em] text-muted">Top concerns on {loserLabel}</div>
          <ul className="space-y-1">
            {(loser.scores?.breakdown?.comparisonHints ?? []).slice(0, 3).map((hint) => (
              <li className="text-[11px] leading-4 text-warning" key={hint}>
                {hint}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
