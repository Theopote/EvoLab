import { edgeKey } from "@/lib/wall-extractor";
import {
  deriveWallGraph,
  findWallEdge,
  pointsNear,
  quantizePoint,
  type WallEdge,
  type WallSide,
  WALL_GRAPH_TOLERANCE
} from "@/lib/wall-graph";
import type { Point, Room, Wall } from "@/lib/project-types";

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

function roomSidesForWall(wall: Wall, rooms: Room[]): WallSide[] {
  const wallKey = edgeKey(wall.start, wall.end);
  const sides: WallSide[] = [];

  rooms.forEach((room) => {
    room.polygon.forEach((vertex, index) => {
      const next = room.polygon[(index + 1) % room.polygon.length]!;

      if (edgeKey(vertex, next) !== wallKey && !segmentsMatch(vertex, next, wall.start, wall.end)) {
        return;
      }

      const nodeAId = quantizePoint(vertex);
      const nodeBId = quantizePoint(next);

      sides.push({
        roomId: room.id,
        edgeIndex: index,
        direction: nodeAId < nodeBId ? "forward" : "reverse"
      });
    });
  });

  return sides;
}

export function findWallEdgeForWall(wall: Wall, rooms: Room[]): WallEdge | undefined {
  const graph = deriveWallGraph(rooms);
  const byId = findWallEdge(graph.edges, wall.id);

  if (byId) {
    return { ...byId, id: wall.id };
  }

  const wallKey = edgeKey(wall.start, wall.end);
  const byKey = graph.edges.find((edge) => edge.key === wallKey);

  if (byKey) {
    return { ...byKey, id: wall.id };
  }

  const roomSides = roomSidesForWall(wall, rooms);

  if (!roomSides.length) {
    return undefined;
  }

  const [nodeAId, nodeBId] = [quantizePoint(wall.start), quantizePoint(wall.end)].sort();

  return {
    id: wall.id,
    key: wallKey,
    nodeAId,
    nodeBId,
    nodeA: [...wall.start] as Point,
    nodeB: [...wall.end] as Point,
    roomIds: wall.roomIds.length ? [...wall.roomIds] : [...new Set(roomSides.map((side) => side.roomId))],
    roomSides
  };
}

export function updateWallEndpoints(
  walls: Wall[],
  wallId: string,
  newStart: Point,
  newEnd: Point,
  tolerance = WALL_GRAPH_TOLERANCE
): Wall[] {
  const target = walls.find((wall) => wall.id === wallId);

  if (!target) {
    return walls;
  }

  const oldStart = target.start;
  const oldEnd = target.end;

  return walls.map((wall) => {
    if (wall.id === wallId) {
      return {
        ...wall,
        start: [...newStart] as Point,
        end: [...newEnd] as Point
      };
    }

    let start = wall.start;
    let end = wall.end;
    let changed = false;

    if (pointsNear(start, oldStart, tolerance)) {
      start = [...newStart] as Point;
      changed = true;
    } else if (pointsNear(start, oldEnd, tolerance)) {
      start = [...newEnd] as Point;
      changed = true;
    }

    if (pointsNear(end, oldStart, tolerance)) {
      end = [...newStart] as Point;
      changed = true;
    } else if (pointsNear(end, oldEnd, tolerance)) {
      end = [...newEnd] as Point;
      changed = true;
    }

    return changed ? { ...wall, start, end } : wall;
  });
}
