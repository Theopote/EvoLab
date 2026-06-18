import type { PlanVersion, Point, Room } from "@/lib/project-types";
import { polygonEdges } from "@/lib/wall-extractor";

export interface RoomGraph {
  adjacency: Map<string, Set<string>>;
  positions: Map<string, Point>;
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function connect(graph: Map<string, Set<string>>, from: string, to: string) {
  if (from === to) {
    return;
  }

  if (!graph.has(from)) {
    graph.set(from, new Set());
  }

  if (!graph.has(to)) {
    graph.set(to, new Set());
  }

  graph.get(from)!.add(to);
  graph.get(to)!.add(from);
}

function inferSharedEdgeAdjacency(rooms: Room[], graph: Map<string, Set<string>>) {
  const edgeOwners = new Map<string, string[]>();

  rooms.forEach((room) => {
    polygonEdges(room.polygon).forEach((edge) => {
      const owners = edgeOwners.get(edge.key) ?? [];
      owners.push(room.id);
      edgeOwners.set(edge.key, owners);
    });
  });

  edgeOwners.forEach((owners) => {
    if (owners.length < 2) {
      return;
    }

    for (let index = 0; index < owners.length; index += 1) {
      for (let other = index + 1; other < owners.length; other += 1) {
        connect(graph, owners[index], owners[other]);
      }
    }
  });
}

export function buildRoomGraph(version: PlanVersion): RoomGraph {
  const adjacency = new Map<string, Set<string>>();
  const positions = new Map<string, Point>();

  version.rooms.forEach((room) => {
    positions.set(room.id, centroid(room));
    adjacency.set(room.id, new Set(room.adjacents ?? []));
  });

  version.rooms.forEach((room) => {
    (room.adjacents ?? []).forEach((adjacentId) => connect(adjacency, room.id, adjacentId));
  });

  inferSharedEdgeAdjacency(version.rooms, adjacency);

  const corridors = version.rooms.filter((room) => room.type === "corridor");
  corridors.forEach((corridor) => {
    version.rooms.forEach((room) => {
      if (room.id === corridor.id) {
        return;
      }

      const corridorSet = adjacency.get(corridor.id);
      if (corridorSet?.has(room.id)) {
        return;
      }

      const distance = Math.hypot(
        positions.get(corridor.id)![0] - positions.get(room.id)![0],
        positions.get(corridor.id)![1] - positions.get(room.id)![1]
      );

      if (distance < Math.max(8, Math.sqrt(room.areaSqm) * 1.4)) {
        connect(adjacency, corridor.id, room.id);
      }
    });
  });

  return { adjacency, positions };
}

function heuristic(from: Point, to: Point) {
  return Math.hypot(from[0] - to[0], from[1] - to[1]);
}

function edgeCost(from: Point, to: Point) {
  return Math.hypot(from[0] - to[0], from[1] - to[1]);
}

export function findRoomPath(graph: RoomGraph, startId: string, goalId: string): Point[] | undefined {
  if (startId === goalId) {
    return [graph.positions.get(startId)!];
  }

  const open = new Set([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startId, 0]]);
  const fScore = new Map<string, number>([
    [startId, heuristic(graph.positions.get(startId)!, graph.positions.get(goalId)!)]
  ]);

  while (open.size > 0) {
    const current = [...open].sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity))[0];
    open.delete(current);

    if (current === goalId) {
      const pathIds = [current];
      while (cameFrom.has(pathIds[0])) {
        pathIds.unshift(cameFrom.get(pathIds[0])!);
      }

      return pathIds.map((roomId) => graph.positions.get(roomId)!);
    }

    const neighbors = graph.adjacency.get(current) ?? new Set<string>();

    neighbors.forEach((neighborId) => {
      const tentativeG =
        (gScore.get(current) ?? Infinity) +
        edgeCost(graph.positions.get(current)!, graph.positions.get(neighborId)!);

      if (tentativeG >= (gScore.get(neighborId) ?? Infinity)) {
        return;
      }

      cameFrom.set(neighborId, current);
      gScore.set(neighborId, tentativeG);
      fScore.set(neighborId, tentativeG + heuristic(graph.positions.get(neighborId)!, graph.positions.get(goalId)!));
      open.add(neighborId);
    });
  }

  return undefined;
}

export function findNearestExitPath(
  graph: RoomGraph,
  version: PlanVersion,
  startRoomId: string
): { path: Point[]; distance: number; exitId: string } | undefined {
  const exits = version.rooms.filter((room) => room.type === "stair" || room.type === "elevator");

  if (exits.length === 0) {
    return undefined;
  }

  let best: { path: Point[]; distance: number; exitId: string } | undefined;

  exits.forEach((exit) => {
    const path = findRoomPath(graph, startRoomId, exit.id);

    if (!path || path.length < 2) {
      return;
    }

    const distance = path.slice(1).reduce((total, point, index) => {
      const previous = path[index];
      return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    }, 0);

    if (!best || distance < best.distance) {
      best = { path, distance, exitId: exit.id };
    }
  });

  return best;
}

export function pathLength(points: Point[]) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);
}
