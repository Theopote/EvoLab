import { clampScore, round1 } from "@/lib/rules/metrics/shared";
import type { MetricResult, ScoringContext } from "@/lib/rules/types";

export const scoreCirculation = (context: ScoringContext): MetricResult => {
  const corridors = context.version.rooms.filter((room) => room.type === "corridor");
  const grossArea = context.version.rooms.reduce((total, room) => total + room.areaSqm, 0);
  const circulationArea = corridors.reduce((total, room) => total + room.areaSqm, 0);
  const circulationRatio = circulationArea / Math.max(1, grossArea);
  const target = context.rulePack.scoring.circulationTargetRatio;
  const tolerance = context.rulePack.scoring.circulationTolerance;
  const deviation = Math.abs(circulationRatio - target);
  const score = clampScore(100 - deviation * (100 / Math.max(0.05, tolerance)));

  return {
    score,
    summary: `Circulation ratio is ${round1(circulationRatio * 100)}% (target ${round1(target * 100)}%).`,
    evidence: [
      { label: "Circulation area", value: `${Math.round(circulationArea)} sqm` },
      { label: "Circulation ratio", value: `${round1(circulationRatio * 100)}%` },
      {
        label: "Target ratio",
        value: `${round1(target * 100)}%`,
        impact: deviation <= tolerance * 0.5 ? "positive" : deviation > tolerance ? "negative" : "neutral"
      }
    ]
  };
};
