import { clampScore, round1 } from "@/lib/rules/metrics/shared";
import { computeWetCorePathMetrics } from "@/lib/rules/path-metrics";
import type { MetricResult, ScoringContext } from "@/lib/rules/types";

export const scoreWetCore = (context: ScoringContext): MetricResult => {
  const metrics = computeWetCorePathMetrics(context.version, context.levelId);
  const maxDistance = context.rulePack.scoring.plumbingMaxDistanceM;
  const pathPenalty = Math.max(0, metrics.averageDistance - maxDistance) * 4;
  const pathScore = clampScore(100 - metrics.averageDistance * 3 - pathPenalty);
  const vertical = metrics.vertical;
  const verticalScore = clampScore(55 + vertical.stackCoverage * 35 + Math.min(10, vertical.stackedShaftCount * 3));
  const capacityScore = clampScore(Math.min(100, vertical.shaftCapacityRatio * 100));
  const stackingBonus = Math.min(8, vertical.stackedShaftCount * 2);
  const score = clampScore(pathScore * 0.5 + verticalScore * 0.3 + capacityScore * 0.2 + stackingBonus);
  const pathRooms = metrics.perRoom.filter((item) => item.method === "path").length;
  const stackAlignedRooms = metrics.perRoom.filter((item) => item.verticalAligned).length;
  const incompleteStackRooms = metrics.perRoom.filter((item) => (item.missingLinks?.length ?? 0) > 0).length;

  return {
    score,
    summary: `Average wet-to-stack path ${round1(metrics.averageDistance)}m; ${vertical.stackGroups} shaft stack(s), capacity ${round1(vertical.shaftCapacityRatio)}x demand.`,
    evidence: [
      { label: "Average path", value: `${round1(metrics.averageDistance)}m` },
      { label: "Max allowed", value: `${maxDistance}m`, impact: metrics.averageDistance <= maxDistance ? "positive" : "negative" },
      { label: "Stack-path rooms", value: `${pathRooms}/${metrics.perRoom.length || 0}` },
      {
        label: "Vertical stack alignment",
        value: `${stackAlignedRooms}/${metrics.perRoom.length || 0}`,
        impact: stackAlignedRooms > 0 ? "positive" : "neutral"
      },
      {
        label: "Vertical stacks",
        value: `${vertical.stackedShaftCount} aligned / ${vertical.stackGroups} group(s)`,
        impact: vertical.stackCoverage >= 0.5 ? "positive" : "neutral"
      },
      {
        label: "Shaft capacity",
        value: `${round1(vertical.shaftAreaSqm)} sqm vs ${round1(vertical.wetDemandSqm)} sqm demand`,
        impact: vertical.shaftCapacityRatio >= 1 ? "positive" : "negative"
      }
    ],
    hints: [
      ...(metrics.averageDistance > maxDistance
        ? [`Wet rooms average ${round1(metrics.averageDistance)}m from shafts (limit ${maxDistance}m).`]
        : []),
      ...(vertical.stackCoverage < 0.5 && context.version.levels.length > 1
        ? ["Shaft stacks are misaligned across floors; vertical riser efficiency is reduced."]
        : []),
      ...(vertical.shaftCapacityRatio < 1
        ? [`Shaft area covers only ${Math.round(vertical.shaftCapacityRatio * 100)}% of estimated wet-core demand.`]
        : []),
      ...(incompleteStackRooms > 0
        ? [`${incompleteStackRooms} wet room(s) are missing horizontal stack path and/or vertical riser alignment.`]
        : [])
    ].filter(Boolean)
  };
};
