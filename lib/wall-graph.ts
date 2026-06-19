import type { Point, Room } from "@/lib/project-types";
import { polygonArea } from "@/lib/plan-validation";
import { edgeKey, pointKey, polygonEdges } from "@/lib/wall-extractor";

export const WALL_GRAPH_TOLERANCE = 0.05;

export interface WallEdge {
  id: string;
  key: string;
  nodeA: Point;
  nodeB: Point;
  roomIds: string[];
}

export function pointsNear(a: Point, b: Point, tolerance = WALL_GRAPH_TOLERANCE) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

export function wallIdToEdgeKey(wallId: string) {
  return wallId.replace(/^wall-/, "").replace(/-/g, "|");
}

export function edgeKeyToWallId(key: string) {
  return `wall-${key.replace(/\|/g, "-")}`;
}

export function deriveWallGraph(rooms: Room[]): WallEdge[] {
  const edges = new Map<string, WallEdge>();

  rooms.forEach((room) => {
    polygonEdges(room.polygon).forEach((edge) => {
      const existing = edges.get(edge.key);

      if (existing) {
        existing.roomIds = Array.from(new Set([...existing.roomIds, room.id]));
        return;
      }

      edges.set(edge.key, {
        id: edgeKeyToWallId(edge.key),
        key: edge.key,
        nodeA: edge.start,
        nodeB: edge.end,
        roomIds: [room.id]
      });
    });
  });

  return [...edges.values()];
}

export function findWallEdge(graph: WallEdge[], wallIdOrKey: string): WallEdge | undefined {
  const edgeKeyValue = wallIdOrKey.startsWith("wall-") ? wallIdToEdgeKey(wallIdOrKey) : wallIdOrKey;

  return graph.find((edge) => edge.key === edgeKeyValue || edge.id === wallIdOrKey);
}

function withRecalculatedArea(room: Room, polygon: Point[]): Room {
  return {
    ...room,
    polygon,
    areaSqm: Number(polygonArea(polygon).toFixed(1))
  };
}

export function applyVertexDrag(rooms: Room[], anchor: Point, next: Point): Room[] {
  return rooms.map((room) => {
    let changed = false;

    const polygon = room.polygon.map((vertex) => {
      if (!pointsNear(vertex, anchor)) {
        return vertex;
      }

      changed = true;
      return [...next] as Point;
    });

    return changed ? withRecalculatedArea(room, polygon) : room;
  });
}

export function applyWallDrag(rooms: Room[], wallId: string, delta: Point): Room[] {
  const graph = deriveWallGraph(rooms);
  const edge = findWallEdge(graph, wallId);

  if (!edge) {
    return rooms;
  }

  const nextA: Point = [edge.nodeA[0] + delta[0], edge.nodeA[1] + delta[1]];
  const nextB: Point = [edge.nodeB[0] + delta[0], edge.nodeB[1] + delta[1]];

  let nextRooms = applyVertexDrag(rooms, edge.nodeA, nextA);
  nextRooms = applyVertexDrag(nextRooms, edge.nodeB, nextB);

  return nextRooms;
}

export function collectVertexAnchors(rooms: Room[]): Point[] {
  const anchors: Point[] = [];

  rooms.forEach((room) => {
    room.polygon.forEach((vertex) => {
      if (!anchors.some((anchor) => pointsNear(anchor, vertex))) {
        anchors.push(vertex);
      }
    });
  });

  return anchors;
}

export function roomIdsTouchingEdge(graph: WallEdge[], edge: WallEdge): string[] {
  return edge.roomIds;
}
