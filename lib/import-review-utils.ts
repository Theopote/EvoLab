import { normalizePlanVersion } from "@/lib/architecture-model";
import { applyLevelRoomsToVersion, getResolvedLevel } from "@/lib/level-rooms";
import { polygonArea } from "@/lib/plan-validation";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

const DEFAULT_CEILING_HEIGHT = 3;

export function resolveImportReviewRooms(version: PlanVersion) {
  const level = version.levels[0];

  if (!level) {
    return version.rooms;
  }

  return getResolvedLevel(version, level.id)?.rooms ?? version.rooms;
}

export function applyImportReviewRooms(version: PlanVersion, rooms: Room[]): PlanVersion {
  const levelId = version.levels[0]?.id;
  const normalized = normalizePlanVersion(version);
  const next = applyLevelRoomsToVersion(normalized, levelId, rooms);

  return normalizePlanVersion(next ?? normalized);
}

export function createTracedImportRoom(polygon: Point[], levelId: string, index: number): Room {
  return {
    id: `import-trace-${Date.now()}-${index}`,
    levelId,
    name: `Traced ${index}`,
    type: "office",
    zone: "private",
    polygon,
    areaSqm: Number(polygonArea(polygon).toFixed(1)),
    ceilingHeight: DEFAULT_CEILING_HEIGHT,
    doors: [],
    windows: [],
    adjacents: []
  };
}

export function removeImportReviewRoom(version: PlanVersion, roomId: string): PlanVersion {
  const rooms = resolveImportReviewRooms(version).filter((room) => room.id !== roomId);
  return applyImportReviewRooms(version, rooms);
}
