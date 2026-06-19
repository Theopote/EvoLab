import { normalizePlanVersion, type PlanVersionDraft } from "@/lib/architecture-model";
import { resolveLevelRooms } from "@/lib/level-rooms";
import { createStandardFloorGroup } from "@/lib/standard-floor-group";
import type { Building, Core, FloorProgram, Level, LevelType, PlanVersion, Room, RoomType, StandardFloorGroup } from "@/lib/project-types";

const CORE_ROOM_TYPES = new Set<RoomType>(["stair", "elevator", "shaft"]);

function resolveFloorProgram(levelIndex: number, floorCount: number): FloorProgram {
  if (levelIndex === 1) {
    return "ground";
  }

  if (levelIndex === floorCount && floorCount > 1) {
    return "top";
  }

  return "typical";
}

function resolveLevelType(program: FloorProgram): LevelType {
  return program;
}

function levelLabel(levelIndex: number, floorCount: number, program: FloorProgram): string {
  const code = String(levelIndex).padStart(2, "0");

  if (program === "ground") {
    return `Level ${code} · Ground / Lobby`;
  }

  if (program === "top") {
    return `Level ${code} · Top / Inpatient`;
  }

  return `Level ${code} · Inpatient`;
}

function adaptRoomForFloorProgram(room: Room, program: FloorProgram): Room {
  if (CORE_ROOM_TYPES.has(room.type) || room.type === "corridor" || room.type === "equipment_room") {
    return room;
  }

  if (program === "ground") {
    switch (room.type) {
      case "lobby":
        return { ...room, name: room.name || "Main Lobby", zone: "public" };
      case "consultation":
        return { ...room, type: "lobby", name: "Reception", zone: "semi_public" };
      case "ward":
      case "bedroom":
        return { ...room, type: "lobby", name: "Waiting Area", zone: "public" };
      case "living_room":
        return { ...room, type: "lobby", name: "Public Lounge", zone: "public" };
      case "office":
        return { ...room, name: "Administration", zone: "semi_public" };
      case "kitchen":
        return { ...room, type: "equipment_room", name: "Cafeteria Prep", zone: "service" };
      case "bathroom":
        return { ...room, name: "Public Restroom", zone: "service" };
      default:
        return room;
    }
  }

  switch (room.type) {
    case "lobby":
      return { ...room, type: "office", name: "Nurse Station", zone: "semi_public" };
    case "consultation":
      return { ...room, type: "ward", name: "Patient Ward", zone: "private", needsDaylight: true };
    case "ward":
      return { ...room, name: "Patient Ward", zone: "private", needsDaylight: true };
    case "bedroom":
      return { ...room, type: "ward", name: "Patient Room", zone: "private", needsDaylight: true };
    case "living_room":
      return { ...room, type: "ward", name: "Patient Ward", zone: "private", needsDaylight: true };
    case "office":
      return { ...room, type: "consultation", name: "Exam Room", zone: "private" };
    case "kitchen":
      return { ...room, type: "equipment_room", name: "Staff Pantry", zone: "service" };
    case "bathroom":
      return { ...room, name: "Patient Bathroom", zone: "service", needsPlumbing: true };
    default:
      return room;
  }
}

function cloneRoomsForLocalLevel(
  templateRooms: Room[],
  levelId: string,
  levelIndex: number,
  floorCount: number
): Room[] {
  const program = resolveFloorProgram(levelIndex, floorCount);
  const idMap = new Map(
    templateRooms.map((room) => [room.id, levelIndex === 1 ? room.id : `${levelId}-${room.id}`])
  );

  return templateRooms.map((room) => {
    const cloned: Room = {
      ...room,
      id: idMap.get(room.id)!,
      levelId,
      name: levelIndex === 1 ? room.name : `${room.name} · L${String(levelIndex).padStart(2, "0")}`,
      adjacents: (room.adjacents ?? []).map((adjacentId) => idMap.get(adjacentId) ?? adjacentId),
      doors: room.doors.map((door) => ({ ...door })),
      windows: room.windows.map((window) => ({ ...window })),
      wallIds: undefined,
      openingIds: undefined
    };

    const adapted = adaptRoomForFloorProgram(cloned, program);

    if (levelIndex > 1 && adapted.name.includes(" · L")) {
      const suffix = ` · L${String(levelIndex).padStart(2, "0")}`;
      const baseName = adapted.name.replace(suffix, "");
      adapted.name = `${baseName}${suffix}`;
    }

    return adapted;
  });
}

function createTypicalGroupRooms(templateRooms: Room[]): Room[] {
  const idMap = new Map(templateRooms.map((room) => [room.id, room.id]));

  return templateRooms.map((room) => {
    const cloned: Room = {
      ...room,
      id: idMap.get(room.id)!,
      adjacents: (room.adjacents ?? []).map((adjacentId) => idMap.get(adjacentId) ?? adjacentId),
      doors: room.doors.map((door) => ({ ...door })),
      windows: room.windows.map((window) => ({ ...window })),
      wallIds: undefined,
      openingIds: undefined
    };

    return adaptRoomForFloorProgram(cloned, "typical");
  });
}

function mergeVerticalCores(building: Building, groups: StandardFloorGroup[]): Building {
  const coreRooms = building.levels.flatMap((level) =>
    resolveLevelRooms(level, groups).filter((room) => CORE_ROOM_TYPES.has(room.type))
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
  const floorPrograms: Array<{ levelIndex: number; program: FloorProgram }> = [];
  const standardFloorGroups: StandardFloorGroup[] = [];
  let typicalGroup: StandardFloorGroup | undefined;

  for (let index = 0; index < targetFloors; index += 1) {
    const levelIndex = index + 1;
    const levelId = `level-${String(levelIndex).padStart(2, "0")}`;
    const program = resolveFloorProgram(levelIndex, targetFloors);
    floorPrograms.push({ levelIndex, program });

    if (program === "typical") {
      if (!typicalGroup) {
        typicalGroup = createStandardFloorGroup({
          id: `std-group-${normalized.id}`,
          label: "Typical inpatient floors",
          rooms: createTypicalGroupRooms(templateRooms),
          outline: normalized.outline,
          memberFloorIds: []
        });
        standardFloorGroups.push(typicalGroup);
      }

      typicalGroup.memberFloorIds.push(levelId);
      levels.push({
        id: levelId,
        name: levelLabel(levelIndex, targetFloors, program),
        floorNumber: levelIndex,
        elevation: 0,
        height: levelHeight,
        levelType: resolveLevelType(program),
        floorProgram: program,
        standardFloorGroupId: typicalGroup.id,
        rooms: [],
        walls: [],
        openings: []
      });
    } else {
      levels.push({
        id: levelId,
        name: levelLabel(levelIndex, targetFloors, program),
        floorNumber: levelIndex,
        elevation: 0,
        height: levelHeight,
        levelType: resolveLevelType(program),
        floorProgram: program,
        rooms: cloneRoomsForLocalLevel(templateRooms, levelId, levelIndex, targetFloors),
        walls: [],
        openings: []
      });
    }
  }

  const expanded = normalizePlanVersion({
    ...normalized,
    levels,
    standardFloorGroups,
    rooms: levels.flatMap((level) => level.rooms),
    metadata: {
      ...normalized.metadata,
      floorCount: targetFloors,
      expandedFromSingleFloor: true,
      differentiatedFloors: true,
      floorPrograms
    }
  } satisfies PlanVersionDraft);

  return {
    ...expanded,
    building: mergeVerticalCores(expanded.building, expanded.standardFloorGroups ?? [])
  };
}

export function getLevelById(version: PlanVersion, levelId?: string) {
  if (!levelId) {
    return version.levels[0];
  }

  return version.levels.find((level) => level.id === levelId) ?? version.levels[0];
}

export function getLevelByIndex(version: PlanVersion, levelIndex: number) {
  const normalizedIndex = Math.max(1, Math.floor(levelIndex));
  return version.levels[normalizedIndex - 1] ?? version.levels[0];
}

export function resolveLevelIdByIndex(version: PlanVersion, levelIndex: number) {
  return getLevelByIndex(version, levelIndex)?.id;
}

export function listComparableLevels(versions: PlanVersion[]) {
  const labels = new Map<string, string>();

  versions.forEach((version) => {
    version.levels.forEach((level, index) => {
      const fallbackName = `Level ${String(index + 1).padStart(2, "0")}`;
      labels.set(level.id, level.name || fallbackName);
    });
  });

  return [...labels.entries()].map(([id, name]) => ({ id, name }));
}

export interface ComparableLevelGroup {
  levelIndex: number;
  name: string;
  levelIds: Record<string, string>;
}

export function listComparableLevelGroups(versions: PlanVersion[]): ComparableLevelGroup[] {
  const maxLevels = Math.max(...versions.map((version) => version.levels.length), 0);
  const groups: ComparableLevelGroup[] = [];

  for (let index = 0; index < maxLevels; index += 1) {
    const levelIndex = index + 1;
    const levelIds: Record<string, string> = {};
    let name = `Level ${String(levelIndex).padStart(2, "0")}`;

    versions.forEach((version) => {
      const level = version.levels[index];

      if (!level) {
        return;
      }

      levelIds[version.id] = level.id;
      name = level.name || name;
    });

    if (Object.keys(levelIds).length > 0) {
      groups.push({ levelIndex, name, levelIds });
    }
  }

  return groups;
}

export function resolveCrossVersionLevelId(
  versions: PlanVersion[],
  referenceLevelId: string,
  targetVersionId: string
) {
  const referenceVersion = versions.find((version) =>
    version.levels.some((level) => level.id === referenceLevelId)
  );

  if (!referenceVersion) {
    return undefined;
  }

  const referenceIndex = referenceVersion.levels.findIndex((level) => level.id === referenceLevelId);

  if (referenceIndex < 0) {
    return undefined;
  }

  const targetVersion = versions.find((version) => version.id === targetVersionId);

  return targetVersion?.levels[referenceIndex]?.id;
}
