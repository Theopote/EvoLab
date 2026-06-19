import { normalizePlanVersion } from "@/lib/architecture-model";
import {
  detachLevelFromGroup,
  editStandardFloorGroup,
  findStandardFloorGroup,
  isLevelLinkedToStandardGroup
} from "@/lib/standard-floor-group";
import type { Level, PlanVersion, Point, Room, StandardFloorGroup } from "@/lib/project-types";
import { polygonArea } from "@/lib/plan-validation";

function stampLevelId(rooms: Room[], levelId: string) {
  return rooms.map((room) => ({
    ...room,
    levelId
  }));
}

export function resolveLevelOutline(
  level: Level,
  groups: StandardFloorGroup[] | undefined,
  versionOutline: Point[]
): Point[] {
  if (level.localOverrideRooms) {
    return versionOutline;
  }

  const group = findStandardFloorGroup(groups, level.standardFloorGroupId);
  return group?.outline ?? versionOutline;
}

/** Resolved rooms for one level — always go through this instead of reading level.rooms directly. */
export function resolveLevelRooms(
  level: Level,
  groups: StandardFloorGroup[] | undefined
): Room[] {
  if (level.localOverrideRooms?.length) {
    return stampLevelId(level.localOverrideRooms, level.id);
  }

  const group = findStandardFloorGroup(groups, level.standardFloorGroupId);
  if (group?.rooms.length) {
    return stampLevelId(group.rooms, level.id);
  }

  return stampLevelId(level.rooms, level.id);
}

export function resolveAllVersionRooms(version: PlanVersion): Room[] {
  const groups = version.standardFloorGroups;

  return version.levels.flatMap((level) => resolveLevelRooms(level, groups));
}

export function getLevelById(version: PlanVersion, levelId?: string) {
  if (!levelId) {
    return version.levels[0];
  }

  return version.levels.find((level) => level.id === levelId) ?? version.levels[0];
}

export function getResolvedLevel(version: PlanVersion, levelId?: string) {
  const level = getLevelById(version, levelId);

  if (!level) {
    return undefined;
  }

  return {
    ...level,
    rooms: resolveLevelRooms(level, version.standardFloorGroups)
  };
}

function syncVersionShell(version: PlanVersion, levels: Level[]): PlanVersion {
  const rooms = levels.flatMap((level) => resolveLevelRooms(level, version.standardFloorGroups));

  return {
    ...version,
    rooms,
    levels,
    building: {
      ...version.building,
      levels
    }
  };
}

export function applyRoomPatchToVersion(
  version: PlanVersion,
  levelId: string | undefined,
  roomId: string,
  patch: Partial<Room>
): PlanVersion | undefined {
  const level = getLevelById(version, levelId);

  if (!level) {
    return undefined;
  }

  const resolvedRooms = resolveLevelRooms(level, version.standardFloorGroups);

  if (!resolvedRooms.some((room) => room.id === roomId)) {
    return undefined;
  }

  const nextRooms = resolvedRooms.map((room) => {
    if (room.id !== roomId) {
      return room;
    }

    const nextRoom = { ...room, ...patch, id: room.id, levelId: level.id };

    if (patch.polygon) {
      nextRoom.areaSqm = Number(polygonArea(patch.polygon).toFixed(1));
    }

    return nextRoom;
  });

  return commitLevelRoomsToVersion(version, level.id, nextRooms);
}

export function applyLevelRoomsToVersion(
  version: PlanVersion,
  levelId: string | undefined,
  rooms: Room[]
): PlanVersion | undefined {
  const level = getLevelById(version, levelId);

  if (!level) {
    return undefined;
  }

  return commitLevelRoomsToVersion(version, level.id, rooms);
}

export function commitLevelRoomsToVersion(
  version: PlanVersion,
  levelId: string,
  rooms: Room[]
): PlanVersion {
  const groups = version.standardFloorGroups ?? [];
  const level = version.levels.find((item) => item.id === levelId);

  if (!level) {
    return version;
  }

  const roomsForStorage = rooms.map((room) => ({
    ...room,
    levelId: level.id
  }));

  if (isLevelLinkedToStandardGroup(level)) {
    const nextGroups = editStandardFloorGroup(groups, level.standardFloorGroupId!, {
      rooms: roomsForStorage.map((room) => ({ ...room, levelId: undefined }))
    });
    const nextLevels = version.levels.map((item) =>
      item.id === level.id ? { ...item, rooms: [] } : item
    );

    return normalizePlanVersion(
      syncVersionShell(
        {
          ...version,
          standardFloorGroups: nextGroups
        },
        nextLevels
      )
    );
  }

  const nextLevels = version.levels.map((item) => {
    if (item.id !== level.id) {
      return item;
    }

    if (item.localOverrideRooms) {
      return {
        ...item,
        localOverrideRooms: roomsForStorage,
        rooms: roomsForStorage
      };
    }

    return {
      ...item,
      rooms: roomsForStorage
    };
  });

  return normalizePlanVersion(syncVersionShell(version, nextLevels));
}

export function detachLevelFromStandardGroup(version: PlanVersion, levelId: string): PlanVersion {
  const level = version.levels.find((item) => item.id === levelId);

  if (!level || !level.standardFloorGroupId) {
    return version;
  }

  const detached = detachLevelFromGroup(level, version.standardFloorGroups ?? []);
  const nextGroups = (version.standardFloorGroups ?? []).map((group) => ({
    ...group,
    memberFloorIds: group.memberFloorIds.filter((id) => id !== levelId)
  }));
  const nextLevels = version.levels.map((item) => (item.id === levelId ? detached : item));

  return normalizePlanVersion(
    syncVersionShell(
      {
        ...version,
        standardFloorGroups: nextGroups.filter((group) => group.memberFloorIds.length > 0)
      },
      nextLevels
    )
  );
}
