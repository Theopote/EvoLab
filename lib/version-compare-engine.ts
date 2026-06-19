import { getLevelById, getLevelByIndex, listComparableLevelGroups } from "@/lib/multi-floor";
import { getResolvedLevel } from "@/lib/level-rooms";
import { calculateQuantities } from "@/lib/quantity-engine";
import { calculateVersionScores } from "@/lib/rules/score-engine";
import { resolveProgramGoals } from "@/lib/rules/program-goals";
import { computeTotalScore } from "@/lib/rules/version-total-score";
import type { PlanVersion, Point } from "@/lib/project-types";
import type { ProgramModel } from "@/lib/building-domain";

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

export interface VersionBuildingCompareRow {
  versionId: string;
  label: string;
  floorCount: number;
  roomCount: number;
  grossArea: number;
  netArea: number;
  totalScore: number;
  circulationRatio: number;
  riskCount: number;
}

export type VersionCompareScope = "selected-level" | "all-levels" | "building-total";

const emptyScores = {
  areaEfficiency: 0,
  circulationScore: 0,
  daylightScore: 0,
  mepAlignmentScore: 0,
  riskCount: 0
};

function scoreVersion(version: PlanVersion, program?: ProgramModel) {
  return computeTotalScore(version.scores ?? emptyScores, resolveProgramGoals(program));
}

function scoreLevel(version: PlanVersion, levelId: string, program?: ProgramModel) {
  const { breakdown } = calculateVersionScores(version, {
    levelId,
    scope: "level",
    projectType: program?.projectType
  });

  return breakdown.totalScore;
}

function corePositionForLevel(version: PlanVersion, levelId: string): Point {
  const rooms = getResolvedLevel(version, levelId)?.rooms ?? [];
  const coreRoom = rooms.find((room) => ["stair", "elevator", "shaft"].includes(room.type));

  if (!coreRoom) {
    return [version.overallBounds.width / 2, version.overallBounds.height / 2];
  }

  const total = coreRoom.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / coreRoom.polygon.length, total[1] / coreRoom.polygon.length];
}

export function compareVersionsAtLevel(
  versions: PlanVersion[],
  levelId: string,
  program?: ProgramModel
): VersionLevelCompareResult {
  const referenceVersion = versions.find((version) => version.levels.some((level) => level.id === levelId));
  const levelIndex = referenceVersion
    ? Math.max(1, referenceVersion.levels.findIndex((level) => level.id === levelId) + 1)
    : 1;

  return compareVersionsAtLevelIndex(versions, levelIndex, levelId, program);
}

export function compareVersionsAtLevelIndex(
  versions: PlanVersion[],
  levelIndex: number,
  displayLevelId?: string,
  program?: ProgramModel
): VersionLevelCompareResult {
  const rows = versions.map((version) => {
    const level = getLevelByIndex(version, levelIndex);
    const levelId = level?.id ?? displayLevelId ?? `level-${String(levelIndex).padStart(2, "0")}`;
    const resolved = getResolvedLevel(version, levelId);
    const quantities = calculateQuantities(version, { levelId, scope: "level" });
    const rooms = resolved?.rooms ?? level?.rooms ?? [];
    const circulationArea = rooms
      .filter((room) => room.type === "corridor" || room.zone === "circulation")
      .reduce((total, room) => total + room.areaSqm, 0);

    return {
      versionId: version.id,
      label: version.label,
      levelId,
      levelName: level?.name ?? `Level ${String(levelIndex).padStart(2, "0")}`,
      roomCount: rooms.length,
      grossArea: quantities.summary.grossArea,
      netArea: quantities.summary.netUsableArea,
      totalScore: scoreLevel(version, levelId, program),
      circulationRatio: quantities.summary.grossArea > 0 ? circulationArea / quantities.summary.grossArea : 0,
      corePosition: corePositionForLevel(version, levelId),
      riskCount: version.scores?.riskCount ?? 0
    };
  });

  return {
    levelId: displayLevelId ?? rows[0]?.levelId ?? `level-${String(levelIndex).padStart(2, "0")}`,
    levelName: rows[0]?.levelName ?? `Level ${String(levelIndex).padStart(2, "0")}`,
    rows
  };
}

export function compareVersionsAcrossLevels(versions: PlanVersion[], levelIds: string[], program?: ProgramModel) {
  return levelIds.map((levelId) => compareVersionsAtLevel(versions, levelId, program));
}

export function compareVersionsAcrossLevelIndices(versions: PlanVersion[], levelIndices: number[], program?: ProgramModel) {
  return levelIndices.map((levelIndex) => compareVersionsAtLevelIndex(versions, levelIndex, undefined, program));
}

export function compareVersionsBuildingTotal(versions: PlanVersion[], program?: ProgramModel): VersionBuildingCompareRow[] {
  return versions.map((version) => {
    const quantities = calculateQuantities(version, { scope: "building" });
    const circulationArea = version.rooms
      .filter((room) => room.type === "corridor" || room.zone === "circulation")
      .reduce((total, room) => total + room.areaSqm, 0);

    return {
      versionId: version.id,
      label: version.label,
      floorCount: version.levels.length,
      roomCount: version.rooms.length,
      grossArea: quantities.summary.grossArea,
      netArea: quantities.summary.netUsableArea,
      totalScore: scoreVersion(version, program),
      circulationRatio: quantities.summary.grossArea > 0 ? circulationArea / quantities.summary.grossArea : 0,
      riskCount: version.scores?.riskCount ?? 0
    };
  });
}

export function resolveLevelIdsForCompare(
  versions: PlanVersion[],
  scope: VersionCompareScope,
  selectedLevelId?: string
) {
  if (scope === "building-total") {
    return [];
  }

  if (scope === "all-levels") {
    return listComparableLevelGroups(versions).map((group) => {
      const referenceVersion = versions[0];

      if (!referenceVersion) {
        return selectedLevelId ?? "level-01";
      }

      return referenceVersion.levels[group.levelIndex - 1]?.id ?? selectedLevelId ?? "level-01";
    });
  }

  return selectedLevelId ? [selectedLevelId] : [];
}

export function recommendLevelId(versions: PlanVersion[], preferredLevelId?: string) {
  const levels = versions.flatMap((version) => version.levels.map((level) => level.id));
  const unique = [...new Set(levels)];

  if (preferredLevelId && unique.includes(preferredLevelId)) {
    return preferredLevelId;
  }

  return unique[0] ?? "level-01";
}

export { scoreVersion, computeTotalScore };
