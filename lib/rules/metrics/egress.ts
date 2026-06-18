import { clampScore, round1 } from "@/lib/rules/metrics/shared";
import { computeEgressPathMetrics, egressMethodLabel } from "@/lib/rules/path-metrics";
import type { MetricResult, ScoringContext } from "@/lib/rules/types";

export const scoreEgress = (context: ScoringContext): MetricResult => {
  const metrics = computeEgressPathMetrics(context.version, context.levelId);
  const maxDistance = context.rulePack.scoring.egressMaxDistanceM;
  const overrun = Math.max(0, metrics.maxDistance - maxDistance);
  const score = clampScore(100 - (metrics.maxDistance / Math.max(1, maxDistance)) * 55 - overrun * 2);
  const semanticRooms = metrics.perRoom.filter((item) => item.semanticValid).length;

  return {
    score,
    summary: `Longest egress path is ${round1(metrics.maxDistance)}m via ${egressMethodLabel(metrics.method)}${metrics.worstRoomName ? ` (${metrics.worstRoomName})` : ""}.`,
    evidence: [
      { label: "Max egress path", value: `${round1(metrics.maxDistance)}m`, impact: metrics.maxDistance <= maxDistance ? "positive" : "negative" },
      { label: "Limit", value: `${maxDistance}m` },
      { label: "Routing method", value: egressMethodLabel(metrics.method) },
      { label: "Semantic routes", value: `${semanticRooms}/${metrics.perRoom.length || 0}` },
      ...(metrics.incompleteRouteCount > 0
        ? [{ label: "Incomplete chains", value: `${metrics.incompleteRouteCount}`, impact: "negative" as const }]
        : [])
    ],
    hints: [
      ...(metrics.maxDistance > maxDistance
        ? [`${metrics.worstRoomName ?? "A room"} exceeds egress limit by ${round1(overrun)}m.`]
        : []),
      ...(metrics.method.startsWith("semantic-") && metrics.method !== "semantic-incomplete"
        ? ["Egress follows door → corridor → stair semantics through the navigation graph."]
        : []),
      ...(metrics.incompleteRouteCount > 0
        ? [`${metrics.incompleteRouteCount} room(s) reach an exit without a complete door-corridor-stair chain.`]
        : []),
      ...(metrics.fallbackRouteCount > 0
        ? [`${metrics.fallbackRouteCount} room(s) use centroid fallback because door or circulation geometry is insufficient.`]
        : [])
    ].filter(Boolean)
  };
};
