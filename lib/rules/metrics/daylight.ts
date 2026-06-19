import { computeDaylightSamples } from "@/lib/analysis/daylight";
import { clampScore, round1 } from "@/lib/rules/metrics/shared";
import type { MetricEvidence, MetricResult, ScoringContext } from "@/lib/rules/types";
import { hasExternalWall, hasWindow, roomFacadeOrientationScore } from "@/lib/rules/metrics/room-geometry";

export const scoreDaylight = (context: ScoringContext): MetricResult => {
  const daylightRooms = context.version.rooms.filter((room) => room.needsDaylight);
  const scopedIssues = (context.issues ?? []).filter((issue) => {
    if (issue.id !== "daylight-room-invalid") {
      return false;
    }

    if (!issue.levelId || context.scope === "building") {
      return true;
    }

    if (context.scope === "floor_group") {
      return context.version.levels.some((level) => level.id === issue.levelId);
    }

    return issue.levelId === context.levelId;
  });
  const maxDepth = context.rulePack.scoring.daylightMaxDepthM;

  if (daylightRooms.length === 0) {
    return {
      score: 82,
      summary: "No daylight-required rooms in program.",
      evidence: [{ label: "Daylight rooms", value: "0" }]
    };
  }

  const samples = computeDaylightSamples(context.version, daylightRooms);
  const evidence: MetricEvidence[] = [];
  let totalScore = 0;
  let depthFailures = 0;
  let windowFailures = 0;

  let orientationMatches = 0;

  daylightRooms.forEach((room) => {
    const sample = samples.find((item) => item.roomId === room.id);
    const touchesExterior = hasExternalWall(context.version, room);
    const hasOpening = hasWindow(context.version, room);
    const depth = sample?.penetration ?? 0;
    const depthOk = depth <= maxDepth;
    const facadeBonus = roomFacadeOrientationScore(context.version, room, context.orientationDeg);
    const roomScoreBase = touchesExterior && hasOpening ? (depthOk ? 100 : Math.max(35, 100 - ((depth - maxDepth) / maxDepth) * 45)) : 0;
    const roomScore = Math.min(100, roomScoreBase + facadeBonus);

    if (facadeBonus > 0) {
      orientationMatches += 1;
    }

    if (!touchesExterior || !hasOpening) {
      windowFailures += 1;
    }
    if (!depthOk) {
      depthFailures += 1;
    }

    totalScore += roomScore;
    evidence.push({
      label: room.name,
      value: `${touchesExterior && hasOpening ? "windowed" : "no window"}, depth ${round1(depth)}m${facadeBonus ? ", preferred orientation" : ""}`,
      impact: roomScore >= 80 ? "positive" : roomScore < 50 ? "negative" : "neutral"
    });
  });

  const validationWarnings = scopedIssues.length;
  const baseScore = totalScore / daylightRooms.length;
  const penalty = (validationWarnings / daylightRooms.length) * 20;
  const score = clampScore(baseScore - penalty);
  const orientationHint =
    context.orientationDeg !== undefined && orientationMatches > 0
      ? `${orientationMatches} room(s) face within 60° of preferred ${context.orientationDeg}° facade.`
      : undefined;
  const hints = [
    ...(windowFailures > 0 ? [`${windowFailures} daylight room(s) lack exterior windows.`] : []),
    ...(depthFailures > 0 ? [`${depthFailures} room(s) exceed recommended depth of ${maxDepth}m.`] : []),
    ...(orientationHint ? [orientationHint] : [])
  ];

  return {
    score,
    summary: `${daylightRooms.length - windowFailures}/${daylightRooms.length} daylight rooms windowed; ${depthFailures} exceed ${maxDepth}m depth.`,
    evidence: evidence.slice(0, 6),
    hints: hints.length ? hints : undefined
  };
};
