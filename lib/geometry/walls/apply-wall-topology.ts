import { polygonArea } from "@/lib/plan-validation";
import { edgeKey } from "@/lib/wall-extractor";
import { pointsNear, WALL_GRAPH_TOLERANCE } from "@/lib/wall-graph";
import {
  canMergeWalls,
  mergeWalls,
  splitWallAtParam
} from "@/lib/geometry/walls/merge-split";
import type { Level, Point, Room, Wall } from "@/lib/project-types";

function segmentsMatch(
  aStart: Point,
  aEnd: Point,
  bStart: Point,
  bEnd: Point,
  tolerance = WALL_GRAPH_TOLERANCE
) {
  return (
    (pointsNear(aStart, bStart, tolerance) && pointsNear(aEnd, bEnd, tolerance)) ||
    (pointsNear(aStart, bEnd, tolerance) && pointsNear(aEnd, bStart, tolerance))
  );
}

function withRecalculatedArea(room: Room, polygon: Point[]): Room {
  return {
    ...room,
    polygon,
    areaSqm: Number(polygonArea(polygon).toFixed(1))
  };
}

function insertSplitPointOnRoomEdge(room: Room, wall: Wall, splitPoint: Point): Room {
  const polygon = room.polygon.map((vertex) => [...vertex] as Point);

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;

    if (edgeKey(start, end) !== edgeKey(wall.start, wall.end) && !segmentsMatch(start, end, wall.start, wall.end)) {
      continue;
    }

    if (polygon.some((vertex) => pointsNear(vertex, splitPoint))) {
      return room;
    }

    const nextPolygon = [...polygon.slice(0, index + 1), splitPoint, ...polygon.slice(index + 1)];
    return withRecalculatedArea(room, nextPolygon);
  }

  return room;
}

function unitVector(start: Point, end: Point): Point {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);

  if (length < 0.001) {
    return [0, 0];
  }

  return [dx / length, dy / length];
}

function removeCollinearVertex(polygon: Point[], point: Point): Point[] | null {
  const index = polygon.findIndex((vertex) => pointsNear(vertex, point));

  if (index === -1 || polygon.length <= 3) {
    return null;
  }

  const previous = polygon[(index - 1 + polygon.length) % polygon.length]!;
  const current = polygon[index]!;
  const next = polygon[(index + 1) % polygon.length]!;
  const vectorA = unitVector(previous, current);
  const vectorB = unitVector(current, next);
  const cross = Math.abs(vectorA[0] * vectorB[1] - vectorA[1] * vectorB[0]);

  if (cross > 0.02) {
    return null;
  }

  return polygon.filter((_, vertexIndex) => vertexIndex !== index);
}

function sharedEndpoint(wallA: Wall, wallB: Wall): Point | undefined {
  if (pointsNear(wallA.start, wallB.start) || pointsNear(wallA.start, wallB.end)) {
    return [...wallA.start] as Point;
  }

  if (pointsNear(wallA.end, wallB.start) || pointsNear(wallA.end, wallB.end)) {
    return [...wallA.end] as Point;
  }

  return undefined;
}

export function findMergeableWallIds(walls: Wall[], wallId: string): string[] {
  return walls
    .filter((candidate) => candidate.id !== wallId && canMergeWalls(walls, wallId, candidate.id))
    .map((candidate) => candidate.id);
}

export function applyLevelWallMerge(level: Level, wallIdA: string, wallIdB: string): Level | undefined {
  const wallA = level.walls.find((wall) => wall.id === wallIdA);
  const wallB = level.walls.find((wall) => wall.id === wallIdB);

  if (!wallA || !wallB) {
    return undefined;
  }

  const merged = mergeWalls(level.walls, wallIdA, wallIdB, level.openings);

  if (!merged) {
    return undefined;
  }

  const joint = sharedEndpoint(wallA, wallB);
  const affectedRoomIds = new Set([...wallA.roomIds, ...wallB.roomIds]);
  const nextRooms = level.rooms.map((room) => {
    if (!affectedRoomIds.has(room.id) || !joint) {
      return room;
    }

    const nextPolygon = removeCollinearVertex(room.polygon, joint);

    return nextPolygon ? withRecalculatedArea(room, nextPolygon) : room;
  });

  return {
    ...level,
    walls: merged.walls,
    openings: merged.openings,
    rooms: nextRooms
  };
}

export function applyLevelWallSplit(level: Level, wallId: string, param: number): Level | undefined {
  const wall = level.walls.find((candidate) => candidate.id === wallId);

  if (!wall) {
    return undefined;
  }

  const secondWallId = `${wallId}-split-${Date.now()}`;
  const split = splitWallAtParam(level.walls, wallId, param, secondWallId, level.openings);

  if (!split) {
    return undefined;
  }

  const nextRooms = level.rooms.map((room) =>
    wall.roomIds.includes(room.id) ? insertSplitPointOnRoomEdge(room, wall, split.splitPoint) : room
  );

  return {
    ...level,
    walls: split.walls,
    openings: split.openings,
    rooms: nextRooms
  };
}
