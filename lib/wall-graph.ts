import type { Point, Room } from "@/lib/project-types";
import { polygonArea } from "@/lib/plan-validation";
import { edgeKeyToWallId, polygonEdges } from "@/lib/wall-extractor";

export const WALL_GRAPH_TOLERANCE = 0.05;
export const HIT_THRESHOLD_M = 0.35;
export const MIN_ROOM_WIDTH = 0.6;

export interface WallNode {
  id: string;
  position: Point;
}

export interface WallSide {
  roomId: string;
  edgeIndex: number;
  direction: "forward" | "reverse";
}

export interface WallEdge {
  id: string;
  key: string;
  nodeAId: string;
  nodeBId: string;
  nodeA: Point;
  nodeB: Point;
  roomIds: string[];
  roomSides: WallSide[];
}

export interface WallGraph {
  nodes: WallNode[];
  edges: WallEdge[];
}

export function pointsNear(a: Point, b: Point, tolerance = WALL_GRAPH_TOLERANCE) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

export function quantizePoint(point: Point, tolerance = WALL_GRAPH_TOLERANCE): string {
  const x = Math.round(point[0] / tolerance) * tolerance;
  const y = Math.round(point[1] / tolerance) * tolerance;
  return `${x},${y}`;
}

export function wallIdToEdgeKey(wallId: string) {
  return wallId.replace(/^wall-/, "").replace(/-/g, "|");
}

export function edgeKeyToWallIdFromKey(key: string) {
  return edgeKeyToWallId(key);
}

export function deriveWallGraph(rooms: Room[], tolerance = WALL_GRAPH_TOLERANCE): WallGraph {
  const nodes = new Map<string, WallNode>();
  const edges = new Map<string, WallEdge>();

  function nodeAt(point: Point): WallNode {
    const id = quantizePoint(point, tolerance);

    if (!nodes.has(id)) {
      nodes.set(id, { id, position: [...point] as Point });
    }

    return nodes.get(id)!;
  }

  rooms.forEach((room) => {
    const vertexCount = room.polygon.length;

    room.polygon.forEach((vertex, index) => {
      const node = nodeAt(vertex);
      node.position = [...vertex] as Point;
      const nextVertex = room.polygon[(index + 1) % vertexCount];
      const nextNode = nodeAt(nextVertex);
      const key = [node.id, nextNode.id].sort().join("|");

      if (!edges.has(key)) {
        const [nodeAId, nodeBId] = [node.id, nextNode.id].sort();

        edges.set(key, {
          id: edgeKeyToWallId(key),
          key,
          nodeAId,
          nodeBId,
          nodeA: nodes.get(nodeAId)!.position,
          nodeB: nodes.get(nodeBId)!.position,
          roomIds: [],
          roomSides: []
        });
      }

      const edge = edges.get(key)!;
      edge.roomSides.push({
        roomId: room.id,
        edgeIndex: index,
        direction: node.id < nextNode.id ? "forward" : "reverse"
      });
      edge.roomIds = Array.from(new Set([...edge.roomIds, room.id]));
      edge.nodeA = [...nodes.get(edge.nodeAId)!.position] as Point;
      edge.nodeB = [...nodes.get(edge.nodeBId)!.position] as Point;
    });
  });

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()]
  };
}

export function findWallEdge(graph: WallEdge[], wallIdOrKey: string): WallEdge | undefined {
  const edgeKeyValue = wallIdOrKey.startsWith("wall-") ? wallIdToEdgeKey(wallIdOrKey) : wallIdOrKey;

  return graph.find((edge) => edge.key === edgeKeyValue || edge.id === wallIdOrKey);
}

export function findWallNode(graph: WallGraph, point: Point): WallNode | undefined {
  return graph.nodes.find((node) => pointsNear(node.position, point));
}

function withRecalculatedArea(room: Room, polygon: Point[]): Room {
  return {
    ...room,
    polygon,
    areaSqm: Number(polygonArea(polygon).toFixed(1))
  };
}

function positionForNodeId(nodeId: string, nodeAId: string, nodeBId: string, newA: Point, newB: Point): Point {
  if (nodeId === nodeAId) {
    return [...newA] as Point;
  }

  if (nodeId === nodeBId) {
    return [...newB] as Point;
  }

  throw new Error(`Node ${nodeId} is not part of the edge.`);
}

export function applyNodeMove(rooms: Room[], edge: WallEdge, newA: Point, newB: Point): Room[] {
  return rooms.map((room) => {
    const side = edge.roomSides.find((candidate) => candidate.roomId === room.id);

    if (!side) {
      return room;
    }

    const polygon = room.polygon.map((vertex) => [...vertex] as Point);
    const startIndex = side.edgeIndex;
    const endIndex = (startIndex + 1) % polygon.length;
    const nodeA = positionForNodeId(edge.nodeAId, edge.nodeAId, edge.nodeBId, newA, newB);
    const nodeB = positionForNodeId(edge.nodeBId, edge.nodeAId, edge.nodeBId, newA, newB);

    if (side.direction === "forward") {
      polygon[startIndex] = nodeA;
      polygon[endIndex] = nodeB;
    } else {
      polygon[startIndex] = nodeB;
      polygon[endIndex] = nodeA;
    }

    return withRecalculatedArea(room, polygon);
  });
}

function vertexIndexForNode(side: WallSide, edge: WallEdge, nodeId: string, polygonLength: number) {
  const touchesNodeA = nodeId === edge.nodeAId;

  if (side.direction === "forward") {
    return touchesNodeA ? side.edgeIndex : (side.edgeIndex + 1) % polygonLength;
  }

  return touchesNodeA ? (side.edgeIndex + 1) % polygonLength : side.edgeIndex;
}

export function applyNodeDrag(rooms: Room[], graph: WallGraph, nodeId: string, next: Point): Room[] {
  const updates = new Map<string, Set<number>>();

  graph.edges.forEach((edge) => {
    if (edge.nodeAId !== nodeId && edge.nodeBId !== nodeId) {
      return;
    }

    edge.roomSides.forEach((side) => {
      const room = rooms.find((candidate) => candidate.id === side.roomId);

      if (!room) {
        return;
      }

      const vertexIndex = vertexIndexForNode(side, edge, nodeId, room.polygon.length);
      const roomUpdates = updates.get(side.roomId) ?? new Set<number>();
      roomUpdates.add(vertexIndex);
      updates.set(side.roomId, roomUpdates);
    });
  });

  return rooms.map((room) => {
    const indices = updates.get(room.id);

    if (!indices?.size) {
      return room;
    }

    const polygon = room.polygon.map((vertex, index) =>
      indices.has(index) ? ([...next] as Point) : ([...vertex] as Point)
    );

    return withRecalculatedArea(room, polygon);
  });
}

export function applyVertexDrag(rooms: Room[], anchor: Point, next: Point): Room[] {
  const graph = deriveWallGraph(rooms);
  const node = findWallNode(graph, anchor);

  if (node) {
    return applyNodeDrag(rooms, graph, node.id, next);
  }

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

export function widthAlongNormal(polygon: Point[], normal: Point) {
  const projections = polygon.map((vertex) => vertex[0] * normal[0] + vertex[1] * normal[1]);
  return Math.max(...projections) - Math.min(...projections);
}

function wallDragIsValid(
  rooms: Room[],
  edge: WallEdge,
  newA: Point,
  newB: Point,
  normal: Point,
  minWidth: number
) {
  const nextRooms = applyNodeMove(rooms, edge, newA, newB);
  const affectedRoomIds = new Set(edge.roomSides.map((side) => side.roomId));

  for (const roomId of affectedRoomIds) {
    const room = nextRooms.find((candidate) => candidate.id === roomId);

    if (!room) {
      return false;
    }

    if (widthAlongNormal(room.polygon, normal) < minWidth - 0.001) {
      return false;
    }

    if (polygonArea(room.polygon) < minWidth * minWidth * 0.5) {
      return false;
    }
  }

  return true;
}

export function clampWallDragOffset(
  offset: number,
  rooms: Room[],
  edge: WallEdge,
  normal: Point,
  minWidth = MIN_ROOM_WIDTH
) {
  if (offset === 0) {
    return 0;
  }

  const newA: Point = [edge.nodeA[0] + normal[0] * offset, edge.nodeA[1] + normal[1] * offset];
  const newB: Point = [edge.nodeB[0] + normal[0] * offset, edge.nodeB[1] + normal[1] * offset];

  if (wallDragIsValid(rooms, edge, newA, newB, normal, minWidth)) {
    return offset;
  }

  let low = 0;
  let high = Math.abs(offset);
  const sign = Math.sign(offset);

  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    const candidateA: Point = [edge.nodeA[0] + normal[0] * mid * sign, edge.nodeA[1] + normal[1] * mid * sign];
    const candidateB: Point = [edge.nodeB[0] + normal[0] * mid * sign, edge.nodeB[1] + normal[1] * mid * sign];

    if (wallDragIsValid(rooms, edge, candidateA, candidateB, normal, minWidth)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low * sign;
}

export function edgeUnitNormal(start: Point, end: Point): Point {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);

  if (length < 0.001) {
    return [0, 1];
  }

  return [-dy / length, dx / length];
}

export function applyWallDragByOffset(
  rooms: Room[],
  wallId: string,
  offset: number,
  normal: Point,
  minWidth = MIN_ROOM_WIDTH
): Room[] {
  const graph = deriveWallGraph(rooms);
  const edge = findWallEdge(graph.edges, wallId);

  if (!edge) {
    return rooms;
  }

  const safeOffset = clampWallDragOffset(offset, rooms, edge, normal, minWidth);
  const newA: Point = [edge.nodeA[0] + normal[0] * safeOffset, edge.nodeA[1] + normal[1] * safeOffset];
  const newB: Point = [edge.nodeB[0] + normal[0] * safeOffset, edge.nodeB[1] + normal[1] * safeOffset];

  return applyNodeMove(rooms, edge, newA, newB);
}

export function applyWallDrag(rooms: Room[], wallId: string, delta: Point): Room[] {
  const graph = deriveWallGraph(rooms);
  const edge = findWallEdge(graph.edges, wallId);

  if (!edge) {
    return rooms;
  }

  const normal = edgeUnitNormal(edge.nodeA, edge.nodeB);
  const offset = delta[0] * normal[0] + delta[1] * normal[1];

  return applyWallDragByOffset(rooms, wallId, offset, normal);
}

export function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared < 0.000001) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  const t = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  const projection: Point = [start[0] + t * dx, start[1] + t * dy];

  return Math.hypot(point[0] - projection[0], point[1] - projection[1]);
}

export function hitTestWalls(cursor: Point, graph: WallGraph, threshold = HIT_THRESHOLD_M): WallEdge | null {
  let closest: WallEdge | null = null;
  let minDistance = Infinity;

  graph.edges.forEach((edge) => {
    const distance = distanceToSegment(cursor, edge.nodeA, edge.nodeB);

    if (distance < threshold && distance < minDistance) {
      minDistance = distance;
      closest = edge;
    }
  });

  return closest;
}

export function collectVertexAnchors(rooms: Room[]): Point[] {
  const graph = deriveWallGraph(rooms);
  return graph.nodes.map((node) => [...node.position] as Point);
}

export function roomsAtNode(graph: WallGraph, nodeId: string): string[] {
  const roomIds = new Set<string>();

  graph.edges.forEach((edge) => {
    if (edge.nodeAId !== nodeId && edge.nodeBId !== nodeId) {
      return;
    }

    edge.roomSides.forEach((side) => roomIds.add(side.roomId));
  });

  return [...roomIds];
}

export function roomIdsTouchingEdge(_graph: WallEdge[], edge: WallEdge): string[] {
  return edge.roomIds;
}

export function findRoomEdge(graph: WallGraph, roomId: string, edgeIndex: number): WallEdge | undefined {
  return graph.edges.find((edge) =>
    edge.roomSides.some((side) => side.roomId === roomId && side.edgeIndex === edgeIndex)
  );
}
