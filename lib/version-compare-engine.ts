import { getLevelById } from "@/lib/multi-floor";
import { calculateQuantities } from "@/lib/quantity-engine";
import type { PlanVersion, Point } from "@/lib/project-types";

export interface VersionLevelCompareRow {
  versionId: string;
  label: string;
  levelId: string;
  levelName: string;
  roomCount: number;
  grossArea: number;
  netArea: number;
  totalScore: number;
  circulationRatio: number;
  corePosition: Point;
  riskCount: number;
}

export interface VersionLevelCompareResult {
  levelId: string;
  levelName: string;
  rows: VersionLevelCompareRow[];
}

function scoreVersion(version: PlanVersion) {
  const scores = version.scores;
  return Math.round(
    Math.max(
      0,
      (scores?.areaEfficiency ?? 0) * 0.28 +
        (scores?.circulationScore ?? 0) * 0.26 +
        (scores?.daylightScore ?? 0) * 0.2 +
        (scores?.mepAlignmentScore ?? 0) * 0.18 -
        (scores?.riskCount ?? 0) * 4
    )
  );
}

function corePositionForLevel(version: PlanVersion, levelId: string): Point {
  const level = getLevelById(version, levelId);
  const rooms = level?.rooms ?? [];
  const coreRoom = rooms.find((room) => ["stair", "elevator", "shaft"].includes(room.type));

  if (!coreRoom) {
    return [version.overallBounds.width / 2, version.overallBounds.height / 2];
  }

  const total = coreRoom.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / coreRoom.polygon.length, total[1] / coreRoom.polygon.length];
}

export function compareVersionsAtLevel(versions: PlanVersion[], levelId: string): VersionLevelCompareResult {
  const rows = versions.map((version) => {
    const level = getLevelById(version, levelId);
    const quantities = calculateQuantities(version, levelId);
    const rooms = level?.rooms ?? [];
    const circulationArea = rooms
      .filter((room) => room.type === "corridor" || room.zone === "circulation")
      .reduce((total, room) => total + room.areaSqm, 0);

    return {
      versionId: version.id,
      label: version.label,
      levelId,
      levelName: level?.name ?? levelId,
      roomCount: rooms.length,
      grossArea: quantities.summary.grossArea,
      netArea: quantities.summary.netUsableArea,
      totalScore: scoreVersion(version),
      circulationRatio: quantities.summary.grossArea > 0 ? circulationArea / quantities.summary.grossArea : 0,
      corePosition: corePositionForLevel(version, levelId),
      riskCount: version.scores?.riskCount ?? 0
    };
  });

  return {
    levelId,
    levelName: rows[0]?.levelName ?? levelId,
    rows
  };
}

export function compareVersionsAcrossLevels(versions: PlanVersion[], levelIds: string[]) {
  return levelIds.map((levelId) => compareVersionsAtLevel(versions, levelId));
}

export function recommendLevelId(versions: PlanVersion[], preferredLevelId?: string) {
  const levels = versions.flatMap((version) => version.levels.map((level) => level.id));
  const unique = [...new Set(levels)];

  if (preferredLevelId && unique.includes(preferredLevelId)) {
    return preferredLevelId;
  }

  return unique[0] ?? "level-01";
}
