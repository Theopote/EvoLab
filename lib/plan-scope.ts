import {
  getLevelById,
  getResolvedLevel,
  resolveAllVersionRooms,
  resolveLevelOutline,
  resolveLevelRooms
} from "@/lib/level-rooms";
import { findStandardFloorGroup } from "@/lib/standard-floor-group";
import type { Level, OpeningElement, PlanVersion, Point, Room, StandardFloorGroup, Wall } from "@/lib/project-types";

export type PlanScopeKind = "level" | "floor_group" | "building";

export interface PlanScopeOptions {
  levelId?: string;
  standardFloorGroupId?: string;
  scope?: PlanScopeKind;
}

export interface ResolvedPlanScope {
  scope: PlanScopeKind;
  levelIds: string[];
  levels: Level[];
  rooms: Room[];
  walls: Wall[];
  openings: OpeningElement[];
  outline: Point[];
  standardFloorGroupId?: string;
  standardFloorGroup?: StandardFloorGroup;
}

export interface LevelValidationUnit {
  levelId: string;
  levelName: string;
  rooms: Room[];
  walls: Wall[];
  openings: OpeningElement[];
  outline: Point[];
}

function resolveScopeKind(version: PlanVersion, options: PlanScopeOptions): PlanScopeKind {
  if (options.scope) {
    return options.scope;
  }

  if (options.standardFloorGroupId) {
    return "floor_group";
  }

  if (options.levelId) {
    const level = getLevelById(version, options.levelId);
    if (level?.standardFloorGroupId && version.levels.length > 1) {
      return "floor_group";
    }

    return "level";
  }

  return version.levels.length > 1 ? "building" : "level";
}

export function resolvePlanScope(version: PlanVersion, options: PlanScopeOptions = {}): ResolvedPlanScope {
  const scope = resolveScopeKind(version, options);
  const groups = version.standardFloorGroups;

  if (scope === "floor_group") {
    const groupId =
      options.standardFloorGroupId ??
      getLevelById(version, options.levelId)?.standardFloorGroupId ??
      groups?.[0]?.id;
    const group = findStandardFloorGroup(groups, groupId);
    const memberLevels = version.levels.filter((level) => level.standardFloorGroupId === groupId);
    const representative = memberLevels[0] ?? getLevelById(version, options.levelId);

    return {
      scope: "floor_group",
      levelIds: memberLevels.map((level) => level.id),
      levels: memberLevels,
      rooms: representative ? resolveLevelRooms(representative, groups) : [],
      walls: representative?.walls ?? [],
      openings: representative?.openings ?? [],
      outline: group?.outline ?? version.outline,
      standardFloorGroupId: groupId,
      standardFloorGroup: group
    };
  }

  if (scope === "level") {
    const levelId = options.levelId ?? version.levels[0]?.id;
    const resolved = getResolvedLevel(version, levelId);

    if (!resolved) {
      return {
        scope: "level",
        levelIds: [],
        levels: [],
        rooms: [],
        walls: [],
        openings: [],
        outline: version.outline
      };
    }

    return {
      scope: "level",
      levelIds: [resolved.id],
      levels: [resolved],
      rooms: resolved.rooms,
      walls: resolved.walls,
      openings: resolved.openings,
      outline: resolveLevelOutline(resolved, groups, version.outline)
    };
  }

  return {
    scope: "building",
    levelIds: version.levels.map((level) => level.id),
    levels: version.levels,
    rooms: resolveAllVersionRooms(version),
    walls: version.levels.flatMap((level) => level.walls),
    openings: version.levels.flatMap((level) => level.openings),
    outline: version.outline
  };
}

/** Slice a version down to one resolved level for path / analysis engines. */
export function scopeVersionForLevel(version: PlanVersion, levelId?: string): PlanVersion {
  if (!levelId) {
    return version;
  }

  const resolved = getResolvedLevel(version, levelId);

  if (!resolved) {
    return version;
  }

  return {
    ...version,
    rooms: resolved.rooms,
    outline: resolveLevelOutline(resolved, version.standardFloorGroups, version.outline),
    levels: [resolved]
  };
}

/** One validation unit per physical level (rooms resolved, outline per level). */
export function collectLevelValidationUnits(version: PlanVersion): LevelValidationUnit[] {
  const groups = version.standardFloorGroups;

  return version.levels.map((level) => {
    const resolved = getResolvedLevel(version, level.id);

    return {
      levelId: level.id,
      levelName: level.name,
      rooms: resolved?.rooms ?? resolveLevelRooms(level, groups),
      walls: resolved?.walls ?? level.walls,
      openings: resolved?.openings ?? level.openings,
      outline: resolveLevelOutline(level, groups, version.outline)
    };
  });
}
