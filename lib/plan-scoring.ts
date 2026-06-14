import type { PlanVersion, VersionScores } from "@/lib/project-types";
import { checkCompliance } from "@/lib/quantity-engine";
import { distance, centroid, type PlanValidationIssue } from "@/lib/plan-validation";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateScores(version: PlanVersion, issues: PlanValidationIssue[] = []): VersionScores {
  const grossArea = version.rooms.reduce((total, room) => total + room.areaSqm, 0);
  const outlineArea = version.overallBounds.width * version.overallBounds.height;
  const areaEfficiency = clampScore((grossArea / Math.max(1, outlineArea)) * 92);
  const corridors = version.rooms.filter((room) => room.type === "corridor");
  const circulationArea = corridors.reduce((total, room) => total + room.areaSqm, 0);
  const circulationRatio = circulationArea / Math.max(1, grossArea);
  const circulationScore = clampScore(100 - Math.abs(circulationRatio - 0.18) * 180);
  const daylightRooms = version.rooms.filter((room) => room.needsDaylight);
  const daylightWarnings = issues.filter((issue) => issue.id === "daylight-room-invalid").length;
  const daylightScore = clampScore(daylightRooms.length ? 100 - (daylightWarnings / daylightRooms.length) * 55 : 82);
  const shaftRooms = version.rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const wetRooms = version.rooms.filter((room) => room.needsPlumbing);
  const averageWetDistance = wetRooms.length && shaftRooms.length
    ? wetRooms.reduce(
        (total, room) => total + Math.min(...shaftRooms.map((shaft) => distance(centroid(room), centroid(shaft)))),
        0
      ) / wetRooms.length
    : 14;
  const mepAlignmentScore = clampScore(100 - averageWetDistance * 3);
  const complianceWarnings = checkCompliance(version).filter((item) => item.status === "warning").length;
  const riskCount = issues.filter((issue) => issue.severity === "error").length + complianceWarnings;

  return {
    areaEfficiency,
    circulationScore,
    daylightScore,
    mepAlignmentScore,
    riskCount
  };
}
