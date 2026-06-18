import { clampScore, round1 } from "@/lib/rules/metrics/shared";
import { computeWetCorePathMetrics } from "@/lib/rules/path-metrics";
import type { MetricResult, ScoringContext } from "@/lib/rules/types";

export const scoreWetCore = (context: ScoringContext): MetricResult => {
  const metrics = computeWetCorePathMetrics(context.version, context.levelId);
  const maxDistance = context.rulePack.scoring.plumbingMaxDistanceM;
  const pathPenalty = Math.max(0, metrics.averageDistance - maxDistance) * 4;
  const pathScore = clampScore(100 - metrics.averageDistance * 3 - pathPenalty);
  const stackingBonus = Math.min(12, metrics.stackedShaftCount * 4);
  const score = clampScore(pathScore + stackingBonus);
  const pathRooms = metrics.perRoom.filter((item) => item.method === "path").length;

  return {
    score,
    summary: `Average wet-to-shaft path is ${round1(metrics.averageDistance)}m; ${metrics.stackedShaftCount} shaft(s) stack across floors.`,
    evidence: [
      { label: "Average path", value: `${round1(metrics.averageDistance)}m` },
      { label: "Max allowed", value: `${maxDistance}m`, impact: metrics.averageDistance <= maxDistance ? "positive" : "negative" },
      { label: "Path-based rooms", value: `${pathRooms}/${metrics.perRoom.length || 0}` },
      { label: "Stacked shafts", value: String(metrics.stackedShaftCount), impact: metrics.stackedShaftCount > 0 ? "positive" : "neutral" }
    ],
    hints:
      metrics.averageDistance > maxDistance
        ? [`Wet rooms average ${round1(metrics.averageDistance)}m from shafts (limit ${maxDistance}m).`]
        : undefined
  };
};
