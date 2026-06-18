import { normalizePlanVersion, type PlanVersionDraft } from "@/lib/architecture-model";
import type { Building, Core, Level, PlanVersion, Room } from "@/lib/project-types";

function cloneRoomsForLevel(templateRooms: Room[], levelId: string, levelIndex: number): Room[] {
  const idMap = new Map(
    templateRooms.map((room) => [room.id, levelIndex === 1 ? room.id : `${levelId}-${room.id}`])
  );

  return templateRooms.map((room) => ({
    ...room,
    id: idMap.get(room.id)!,
    levelId,
    name: levelIndex === 1 ? room.name : `${room.name} · L${String(levelIndex).padStart(2, "0")}`,
    adjacents: (room.adjacents ?? []).map((adjacentId) => idMap.get(adjacentId) ?? adjacentId),
    doors: room.doors.map((door) => ({ ...door })),
    windows: room.windows.map((window) => ({ ...window })),
    wallIds: undefined,
    openingIds: undefined
  }));
}

function mergeVerticalCores(building: Building): Building {
  const coreRooms = building.levels.flatMap((level) =>
    level.rooms.filter((room) => ["stair", "elevator", "shaft"].includes(room.type))
  );

  if (coreRooms.length === 0) {
    return building;
  }

  const mergedCore: Core = {
    id: "core-vertical-01",
    levelIds: building.levels.map((level) => level.id),
    roomIds: coreRooms.map((room) => room.id),
    wallIds: building.levels.flatMap((level) => level.walls.filter((wall) => wall.type === "core").map((wall) => wall.id)),
    type: coreRooms.some((room) => room.type === "shaft")
      ? "mixed"
      : coreRooms.some((room) => room.type === "stair")
        ? "stair"
        : "elevator"
  };

  return {
    ...building,
    cores: [mergedCore]
  };
}

export function expandPlanVersionToFloors(version: PlanVersion, floorCount: number): PlanVersion {
  const normalized = normalizePlanVersion(version);
  const targetFloors = Math.max(1, Math.min(60, Math.floor(floorCount)));

  if (targetFloors <= 1) {
    return normalized;
  }

  if (normalized.levels.length > 1 && normalized.metadata?.floorCount === targetFloors) {
    return normalized;
  }

  const templateLevel = normalized.levels[0];
  const templateRooms = templateLevel?.rooms.length ? templateLevel.rooms : normalized.rooms;

  if (!templateRooms.length) {
    return normalized;
  }

  const levelHeight = templateLevel?.height ?? Math.max(3, ...templateRooms.map((room) => room.ceilingHeight));
  const levels: Level[] = [];
  let elevation = 0;

  for (let index = 0; index < targetFloors; index += 1) {
    const levelIndex = index + 1;
    const levelId = `level-${String(levelIndex).padStart(2, "0")}`;
    const levelLabel =
      levelIndex === 1 ? "Level 01" : levelIndex === targetFloors ? `Level ${String(levelIndex).padStart(2, "0")} · Top` : `Level ${String(levelIndex).padStart(2, "0")}`;

    levels.push({
      id: levelId,
      name: levelLabel,
      elevation,
      height: levelHeight,
      rooms: cloneRoomsForLevel(templateRooms, levelId, levelIndex),
      walls: [],
      openings: []
    });

    elevation += levelHeight;
  }

  const expanded = normalizePlanVersion({
    ...normalized,
    levels,
    rooms: levels.flatMap((level) => level.rooms),
    metadata: {
      ...normalized.metadata,
      floorCount: targetFloors,
      expandedFromSingleFloor: true
    }
  } satisfies PlanVersionDraft);

  return {
    ...expanded,
    building: mergeVerticalCores(expanded.building)
  };
}

export function getLevelById(version: PlanVersion, levelId?: string) {
  if (!levelId) {
    return version.levels[0];
  }

  return version.levels.find((level) => level.id === levelId) ?? version.levels[0];
}

export function listComparableLevels(versions: PlanVersion[]) {
  const labels = new Map<string, string>();

  versions.forEach((version) => {
    version.levels.forEach((level) => {
      labels.set(level.id, level.name);
    });
  });

  return [...labels.entries()].map(([id, name]) => ({ id, name }));
}
