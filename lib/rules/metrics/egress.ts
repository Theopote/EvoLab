import { clampScore, round1 } from "@/lib/rules/metrics/shared";
import { computeEgressPathMetrics } from "@/lib/rules/path-metrics";
import type { MetricResult, ScoringContext } from "@/lib/rules/types";

export const scoreEgress = (context: ScoringContext): MetricResult => {
  const metrics = computeEgressPathMetrics(context.version, context.levelId);
  const maxDistance = context.rulePack.scoring.egressMaxDistanceM;
  const overrun = Math.max(0, metrics.maxDistance - maxDistance);
  const score = clampScore(100 - (metrics.maxDistance / Math.max(1, maxDistance)) * 55 - overrun * 2);
  const pathRooms = metrics.perRoom.filter((item) => item.method === "path").length;

  return {
    score,
    summary: `Longest egress path is ${round1(metrics.maxDistance)}m via ${metrics.method}${metrics.worstRoomName ? ` (${metrics.worstRoomName})` : ""}.`,
    evidence: [
      { label: "Max egress path", value: `${round1(metrics.maxDistance)}m`, impact: metrics.maxDistance <= maxDistance ? "positive" : "negative" },
      { label: "Limit", value: `${maxDistance}m` },
      { label: "Routing method", value: metrics.method },
      { label: "Path-routed rooms", value: `${pathRooms}/${metrics.perRoom.length || 0}` }
    ],
    hints:
      metrics.maxDistance > maxDistance
        ? [`${metrics.worstRoomName ?? "A room"} exceeds egress limit by ${round1(overrun)}m.`]
        : undefined
  };
};
