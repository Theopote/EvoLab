import { normalizePlanVersion } from "@/lib/architecture-model";
import {
  openingFitsOnWall,
  openingPositionLimits,
  validateOpeningDraft
} from "@/lib/opening-wall-utils";
import type { PlanVersionDraft } from "@/lib/architecture-model";
import type { Opening, PlanVersion, Room, Wall } from "@/lib/project-types";
import { edgeKey, polygonEdges } from "@/lib/wall-extractor";
import type { PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";

function wallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

function edgeOrientation(start: [number, number], end: [number, number]): Opening["wall"] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dy >= 0 ? "south" : "north";
  }

  return dx >= 0 ? "east" : "west";
}

export function findWallForRoomOrientation(room: Room, orientation: Opening["wall"], walls: Wall[]): Wall | undefined {
  const roomWallIds = new Set(room.wallIds ?? []);
  const candidates = walls.filter((wall) => roomWallIds.has(wall.id) || wall.roomIds.includes(room.id));

  const edge = polygonEdges(room.polygon).find((item) => {
    const forward = edgeOrientation(item.start, item.end);
    const reverse = edgeOrientation(item.end, item.start);
    return forward === orientation || reverse === orientation;
  });

  if (!edge) {
    return candidates[0];
  }

  const key = edgeKey(edge.start, edge.end);
  return candidates.find((wall) => edgeKey(wall.start, wall.end) === key) ?? candidates[0];
}

export function clampLegacyOpeningParams(
  wall: Wall,
  width: number,
  position: number
): { width: number; position: number } | null {
  let nextWidth = Math.max(0.4, Math.min(6, width));

  if (nextWidth > wallLength(wall) - 0.1) {
    nextWidth = Math.max(0.4, wallLength(wall) - 0.1);
  }

  const limits = openingPositionLimits(wall, nextWidth);

  if (!limits) {
    return null;
  }

  const nextPosition = Math.max(limits.min, Math.min(limits.max, position));

  if (!openingFitsOnWall(wall, nextWidth, nextPosition)) {
    return null;
  }

  return { width: Number(nextWidth.toFixed(2)), position: Number(nextPosition.toFixed(3)) };
}

export interface SanitizedLegacyOpening {
  opening: Opening;
  repaired: boolean;
  removed: boolean;
  reason?: string;
}

export function sanitizeLegacyOpening(
  opening: Opening,
  room: Room,
  walls: Wall[],
  kind: "door" | "window"
): SanitizedLegacyOpening {
  const wall = findWallForRoomOrientation(room, opening.wall, walls);

  if (!wall) {
    return {
      opening,
      repaired: false,
      removed: true,
      reason: "No parent wall found for opening orientation."
    };
  }

  const clamped = clampLegacyOpeningParams(wall, opening.width, opening.position);

  if (!clamped) {
    return {
      opening,
      repaired: false,
      removed: true,
      reason: "Opening does not fit on the resolved wall segment."
    };
  }

  const height = kind === "door" ? 2.1 : 1.5;
  const sillHeight = kind === "door" ? 0 : 0.9;
  const validation = validateOpeningDraft({
    openingType: kind,
    wall,
    wallHeight: wall.height,
    width: clamped.width,
    position: clamped.position,
    height,
    sillHeight
  });

  if (Object.keys(validation).length > 0) {
    return {
      opening,
      repaired: false,
      removed: true,
      reason: Object.values(validation).join(" ")
    };
  }

  const repaired =
    Math.abs(clamped.width - opening.width) > 0.001 || Math.abs(clamped.position - opening.position) > 0.001;

  return {
    opening: {
      wall: opening.wall,
      width: clamped.width,
      position: clamped.position
    },
    repaired,
    removed: false
  };
}

export function sanitizeRoomLegacyOpenings(
  room: Room,
  walls: Wall[]
): { room: Room; repairs: string[] } {
  const repairs: string[] = [];
  const doors: Opening[] = [];
  const windows: Opening[] = [];

  room.doors.forEach((opening, index) => {
    const result = sanitizeLegacyOpening(opening, room, walls, "door");

    if (result.removed) {
      repairs.push(`${room.name} door #${index + 1} removed: ${result.reason ?? "invalid geometry"}`);
      return;
    }

    if (result.repaired) {
      repairs.push(`${room.name} door #${index + 1} clamped to fit wall.`);
    }

    doors.push(result.opening);
  });

  room.windows.forEach((opening, index) => {
    const result = sanitizeLegacyOpening(opening, room, walls, "window");

    if (result.removed) {
      repairs.push(`${room.name} window #${index + 1} removed: ${result.reason ?? "invalid geometry"}`);
      return;
    }

    if (result.repaired) {
      repairs.push(`${room.name} window #${index + 1} clamped to fit wall.`);
    }

    windows.push(result.opening);
  });

  return {
    room: {
      ...room,
      doors,
      windows
    },
    repairs
  };
}

export function enforceOpeningConstraintsOnVersion(version: PlanVersion): { version: PlanVersion; repairs: string[] } {
  const repairs: string[] = [];
  const nextLevels = version.levels.map((level) => {
    const nextRooms = level.rooms.map((room) => {
      const result = sanitizeRoomLegacyOpenings(room, level.walls);
      repairs.push(...result.repairs);
      return result.room;
    });

    return {
      ...level,
      rooms: nextRooms
    };
  });

  const draft: PlanVersionDraft = {
    ...version,
    rooms: nextLevels.flatMap((level) => level.rooms),
    levels: nextLevels
  };

  return {
    version: normalizePlanVersion(draft),
    repairs
  };
}

export function sanitizeAddOpeningOperation(
  version: PlanVersion,
  operation: Extract<PlanOperation, { type: "add_opening" }>
): Extract<PlanOperation, { type: "add_opening" }> | null {
  const room = version.rooms.find((item) => item.id === operation.roomId);

  if (!room) {
    return null;
  }

  const normalized = normalizePlanVersion(version);
  const level = normalized.levels.find((item) => item.rooms.some((entry) => entry.id === room.id)) ?? normalized.levels[0];
  const wall = findWallForRoomOrientation(room, operation.wall, level?.walls ?? []);

  if (!wall) {
    return null;
  }

  const clamped = clampLegacyOpeningParams(wall, operation.width, operation.position);

  if (!clamped) {
    return null;
  }

  return {
    ...operation,
    width: clamped.width,
    position: clamped.position
  };
}

export function sanitizeResizeOpeningOperation(
  version: PlanVersion,
  operation: Extract<PlanOperation, { type: "resize_opening" }>
): Extract<PlanOperation, { type: "resize_opening" }> | null {
  const room = version.rooms.find((item) => item.id === operation.roomId);

  if (!room) {
    return null;
  }

  const openings = operation.openingKind === "door" ? room.doors : room.windows;
  const existing = openings[operation.openingIndex];

  if (!existing) {
    return null;
  }

  const normalized = normalizePlanVersion(version);
  const level = normalized.levels.find((item) => item.rooms.some((entry) => entry.id === room.id)) ?? normalized.levels[0];
  const wall = findWallForRoomOrientation(room, existing.wall, level?.walls ?? []);

  if (!wall) {
    return null;
  }

  const clamped = clampLegacyOpeningParams(wall, operation.width, existing.position);

  if (!clamped) {
    return null;
  }

  return {
    ...operation,
    width: clamped.width
  };
}

export function isOpeningOperationValid(version: PlanVersion, operation: PlanOperation) {
  if (operation.type === "add_opening") {
    return sanitizeAddOpeningOperation(version, operation) !== null;
  }

  if (operation.type === "resize_opening") {
    return sanitizeResizeOpeningOperation(version, operation) !== null;
  }

  return true;
}
