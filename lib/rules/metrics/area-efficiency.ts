import { clampScore } from "@/lib/rules/metrics/shared";
import type { MetricResult, ScoringContext } from "@/lib/rules/types";

export const scoreAreaEfficiency = (context: ScoringContext): MetricResult => {
  const grossArea = context.version.rooms.reduce((total, room) => total + room.areaSqm, 0);
  const outlineArea = context.version.overallBounds.width * context.version.overallBounds.height;
  const ratio = grossArea / Math.max(1, outlineArea);
  const score = clampScore(ratio * context.rulePack.scoring.areaEfficiencyFactor);

  return {
    score,
    summary: `Gross area is ${Math.round(ratio * 100)}% of the outline envelope.`,
    evidence: [
      { label: "Gross area", value: `${Math.round(grossArea)} sqm` },
      { label: "Outline area", value: `${Math.round(outlineArea)} sqm` },
      { label: "Fill ratio", value: `${Math.round(ratio * 100)}%`, impact: ratio >= 0.75 ? "positive" : "neutral" }
    ]
  };
};
