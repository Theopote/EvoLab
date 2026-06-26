import { normalizePlanVersion } from "@/lib/architecture-model";
import { intersectionArea } from "@/lib/geometry/kernel";
import { applyLevelRoomsToVersion, getResolvedLevel } from "@/lib/level-rooms";
import { polygonArea, validatePlanVersion, type PlanValidationIssue } from "@/lib/plan-validation";
import type { FunctionZone, PlanVersion, Point, Room, RoomType } from "@/lib/project-types";

const DEFAULT_CEILING_HEIGHT = 3;
const MIN_IMPORT_ROOM_AREA_SQM = 2;

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

export function updateImportReviewRoom(
  version: PlanVersion,
  roomId: string,
  patch: Partial<Pick<Room, "name" | "type" | "zone">>
): PlanVersion {
  const rooms = resolveImportReviewRooms(version).map((room) =>
    room.id === roomId ? { ...room, ...patch } : room
  );

  return applyImportReviewRooms(version, rooms);
}

export function recalculateImportReviewAreas(version: PlanVersion): PlanVersion {
  const rooms = resolveImportReviewRooms(version).map((room) => ({
    ...room,
    areaSqm: Number(polygonArea(room.polygon).toFixed(1))
  }));

  return applyImportReviewRooms(version, rooms);
}

const IMPORT_REVIEW_ISSUE_IDS = new Set([
  "room-polygon-invalid",
  "room-overlap",
  "room-area-mismatch",
  "corridor-disconnected"
]);

export function validateImportReviewDraft(version: PlanVersion): PlanValidationIssue[] {
  const rooms = resolveImportReviewRooms(version);
  const issues: PlanValidationIssue[] = [];

  rooms.forEach((room) => {
    if (room.polygon.length < 3) {
      issues.push({
        id: "room-polygon-invalid",
        severity: "error",
        message: `「${room.name}」轮廓未闭合（少于 3 个顶点）。`,
        roomIds: [room.id]
      });
      return;
    }

    const actualArea = polygonArea(room.polygon);
    if (actualArea < MIN_IMPORT_ROOM_AREA_SQM) {
      issues.push({
        id: "room-area-too-small",
        severity: "warning",
        message: `「${room.name}」面积过小（${actualArea.toFixed(1)} ㎡）。`,
        roomIds: [room.id]
      });
    }
  });

  rooms.forEach((room, index) => {
    rooms.slice(index + 1).forEach((otherRoom) => {
      const leftArea = polygonArea(room.polygon);
      const rightArea = polygonArea(otherRoom.polygon);
      const overlapArea = intersectionArea(room.polygon, otherRoom.polygon);
      const tolerance = Math.min(leftArea, rightArea) * 0.05;

      if (overlapArea > Math.max(0.5, tolerance)) {
        issues.push({
          id: "room-overlap",
          severity: "error",
          message: `「${room.name}」与「${otherRoom.name}」重叠（${overlapArea.toFixed(1)} ㎡）。`,
          roomIds: [room.id, otherRoom.id]
        });
      }
    });
  });

  const validated = validatePlanVersion(version).issues.filter((issue) => IMPORT_REVIEW_ISSUE_IDS.has(issue.id));
  const merged = [...issues];

  for (const issue of validated) {
    if (merged.some((existing) => existing.roomIds?.join() === issue.roomIds?.join() && existing.id === issue.id)) {
      continue;
    }

    merged.push(issue);
  }

  return merged;
}

export const importReviewRoomTypes: RoomType[] = [
  "lobby",
  "corridor",
  "consultation",
  "ward",
  "office",
  "living_room",
  "bedroom",
  "kitchen",
  "bathroom",
  "stair",
  "elevator",
  "shaft",
  "equipment_room",
  "other"
];

export const importReviewZones: FunctionZone[] = ["public", "semi_public", "private", "service", "circulation"];
