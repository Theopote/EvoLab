import type { OpeningElement, PlanVersion, Point, Room } from "@/lib/project-types";
import { extractWallsFromRooms } from "@/lib/wall-extractor";

export type PlanValidationSeverity = "warning" | "error";

export interface PlanValidationIssue {
  id: string;
  severity: PlanValidationSeverity;
  message: string;
  roomIds?: string[];
}

export interface PlanValidationResult {
  valid: boolean;
  issues: PlanValidationIssue[];
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function polygonArea(points: Point[]) {
  const area = points.reduce((total, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return total + x * nextY - nextX * y;
  }, 0);

  return Math.abs(area) / 2;
}

export function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function bounds(points: Point[]) {
  return points.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function bboxOverlapArea(a: Point[], b: Point[]) {
  const ab = bounds(a);
  const bb = bounds(b);
  const width = Math.min(ab.maxX, bb.maxX) - Math.max(ab.minX, bb.minX);
  const height = Math.min(ab.maxY, bb.maxY) - Math.max(ab.minY, bb.minY);
  return width > 0 && height > 0 ? width * height : 0;
}

function bboxDistance(a: Point[], b: Point[]) {
  const ab = bounds(a);
  const bb = bounds(b);
  const dx = Math.max(0, Math.max(ab.minX - bb.maxX, bb.minX - ab.maxX));
  const dy = Math.max(0, Math.max(ab.minY - bb.maxY, bb.minY - ab.maxY));
  return Math.hypot(dx, dy);
}

function pointOnSegment(point: Point, start: Point, end: Point) {
  const cross = (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > 0.001) {
    return false;
  }

  const dot = (point[0] - start[0]) * (end[0] - start[0]) + (point[1] - start[1]) * (end[1] - start[1]);
  if (dot < -0.001) {
    return false;
  }

  const squaredLength = distance(start, end) ** 2;
  return dot <= squaredLength + 0.001;
}

function pointInPolygon(point: Point, polygon: Point[]) {
  if (polygon.some((start, index) => pointOnSegment(point, start, polygon[(index + 1) % polygon.length]))) {
    return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function hasWindow(version: PlanVersion, room: Room) {
  const openings: OpeningElement[] = version.levels?.[0]?.openings ?? [];
  return openings.length
    ? openings.some((opening) => opening.type === "window" && opening.roomIds?.includes(room.id))
    : room.windows.length > 0;
}

function hasExternalWall(version: PlanVersion, room: Room) {
  const walls = version.levels?.[0]?.walls?.length
    ? version.levels[0].walls
    : extractWallsFromRooms(version.rooms, version.outline);

  return walls.some((wall) => wall.type === "external" && wall.roomIds.includes(room.id));
}

function validateCorridorConnectivity(rooms: Room[]) {
  const corridors = rooms.filter((room) => room.type === "corridor");

  if (corridors.length <= 1) {
    return true;
  }

  const corridorIds = new Set(corridors.map((room) => room.id));
  const visited = new Set<string>();
  const queue = [corridors[0].id];

  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) {
      continue;
    }

    visited.add(id);
    const room = rooms.find((item) => item.id === id);
    room?.adjacents?.forEach((adjacentId) => {
      if (corridorIds.has(adjacentId) && !visited.has(adjacentId)) {
        queue.push(adjacentId);
      }
    });
  }

  return corridors.every((room) => visited.has(room.id));
}

export function validatePlanVersion(version: PlanVersion): PlanValidationResult {
  const issues: PlanValidationIssue[] = [];

  if (version.outline.length < 3) {
    issues.push({ id: "outline-invalid", severity: "error", message: "Outline must contain at least three points." });
  }

  version.rooms.forEach((room) => {
    if (room.polygon.length < 3) {
      issues.push({ id: "room-polygon-invalid", severity: "error", message: `${room.name} has invalid polygon geometry.`, roomIds: [room.id] });
      return;
    }

    if (!room.polygon.every((point) => pointInPolygon(point, version.outline))) {
      issues.push({ id: "room-outside-outline", severity: "error", message: `${room.name} is not fully inside the building outline.`, roomIds: [room.id] });
    }

    const actualArea = polygonArea(room.polygon);
    const deviation = Math.abs(actualArea - room.areaSqm) / Math.max(1, room.areaSqm);
    if (deviation > 0.2) {
      issues.push({ id: "room-area-mismatch", severity: "warning", message: `${room.name} area differs from polygon area by more than 20%.`, roomIds: [room.id] });
    }
  });

  version.rooms.forEach((room, index) => {
    version.rooms.slice(index + 1).forEach((otherRoom) => {
      const overlap = bboxOverlapArea(room.polygon, otherRoom.polygon);
      const tolerance = Math.min(polygonArea(room.polygon), polygonArea(otherRoom.polygon)) * 0.05;
      if (overlap > Math.max(0.5, tolerance)) {
        issues.push({
          id: "room-overlap",
          severity: "error",
          message: `${room.name} overlaps ${otherRoom.name}.`,
          roomIds: [room.id, otherRoom.id]
        });
      }
    });
  });

  if (!validateCorridorConnectivity(version.rooms)) {
    issues.push({ id: "corridor-disconnected", severity: "warning", message: "Corridor rooms should form one connected circulation graph." });
  }

  const coreRooms = version.rooms.filter((room) => room.type === "stair" || room.type === "elevator");
  if (coreRooms.length === 0) {
    issues.push({ id: "core-missing", severity: "error", message: "At least one stair or elevator core is required." });
  }

  version.rooms
    .filter((room) => room.needsDaylight)
    .forEach((room) => {
      if (!hasExternalWall(version, room) || !hasWindow(version, room)) {
        issues.push({
          id: "daylight-room-invalid",
          severity: "warning",
          message: `${room.name} needs daylight and should touch an external wall with a window.`,
          roomIds: [room.id]
        });
      }
    });

      const shafts = version.rooms.filter((room) => room.type === "shaft");
  version.rooms
    .filter((room) => room.needsPlumbing)
    .forEach((room) => {
      const nearestShaft = shafts.length ? Math.min(...shafts.map((shaft) => bboxDistance(room.polygon, shaft.polygon))) : Infinity;
      if (nearestShaft > 12) {
        issues.push({
          id: "plumbing-too-far",
          severity: "warning",
          message: `${room.name} needs plumbing and should be near a shaft.`,
          roomIds: [room.id]
        });
      }
    });

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}
