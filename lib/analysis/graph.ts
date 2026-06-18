import {
  buildPathGraph,
  findNearestExitPathGraph,
  findPathGraphRoute,
  pathLength,
  type PathGraph,
  type PathGraphMethod
} from "@/lib/analysis/path-graph";
import { computeSemanticEgressForRoom } from "@/lib/analysis/egress-semantics";
import type { PlanVersion, Point, Room } from "@/lib/project-types";
import { polygonEdges } from "@/lib/wall-extractor";

export type RoomGraphMethod = PathGraphMethod;

export interface RoomGraph {
  adjacency: Map<string, Set<string>>;
  positions: Map<string, Point>;
  method: RoomGraphMethod;
  pathGraph?: PathGraph;
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

function collapsePathGraph(pathGraph: PathGraph, rooms: Room[]): RoomGraph {
  const adjacency = new Map<string, Set<string>>();
  const positions = new Map<string, Point>();

  rooms.forEach((room) => {
    positions.set(room.id, centroid(room));
    adjacency.set(room.id, new Set());
  });

  rooms.forEach((room) => {
    rooms.forEach((other) => {
      if (room.id === other.id) {
        return;
      }

      const route = findPathGraphRoute(pathGraph, room.id, other.id);
      if (route) {
        connect(adjacency, room.id, other.id);
      }
    });
  });

  return {
    adjacency,
    positions,
    method: pathGraph.method,
    pathGraph
  };
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

function inferDoorOpeningAdjacency(version: PlanVersion, graph: Map<string, Set<string>>) {
  const openings = version.levels.flatMap((level) => level.openings ?? []);
  let linked = false;

  openings
    .filter((opening) => opening.type === "door")
    .forEach((opening) => {
      const roomIds = opening.roomIds ?? [];
      for (let index = 0; index < roomIds.length; index += 1) {
        for (let other = index + 1; other < roomIds.length; other += 1) {
          connect(graph, roomIds[index], roomIds[other]);
          linked = true;
        }
      }
    });

  version.rooms.forEach((room) => {
    if (room.doors.length === 0) {
      return;
    }

    room.adjacents?.forEach((adjacentId) => {
      connect(graph, room.id, adjacentId);
      linked = true;
    });
  });

  return linked;
}

function inferCirculationPortalAdjacency(version: PlanVersion, graph: Map<string, Set<string>>) {
  const corridors = version.rooms.filter((room) => room.type === "corridor");
  const cores = version.rooms.filter((room) => ["stair", "elevator"].includes(room.type));

  corridors.forEach((corridor) => {
    cores.forEach((core) => {
      if (corridor.adjacents?.includes(core.id) || core.adjacents?.includes(corridor.id)) {
        connect(graph, corridor.id, core.id);
      }
    });
  });
}

function buildLegacyRoomGraph(version: PlanVersion): RoomGraph {
  const adjacency = new Map<string, Set<string>>();
  const positions = new Map<string, Point>();

  version.rooms.forEach((room) => {
    positions.set(room.id, centroid(room));
    adjacency.set(room.id, new Set());
  });

  version.rooms.forEach((room) => {
    (room.adjacents ?? []).forEach((adjacentId) => connect(adjacency, room.id, adjacentId));
  });

  inferSharedEdgeAdjacency(version.rooms, adjacency);
  const hasDoorLinks = inferDoorOpeningAdjacency(version, adjacency);
  inferCirculationPortalAdjacency(version, adjacency);

  if (!hasDoorLinks) {
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

        const span = Math.hypot(
          positions.get(corridor.id)![0] - positions.get(room.id)![0],
          positions.get(corridor.id)![1] - positions.get(room.id)![1]
        );

        if (span < Math.max(8, Math.sqrt(room.areaSqm) * 1.4) && (room.doors.length > 0 || room.type === "corridor")) {
          connect(adjacency, corridor.id, room.id);
        }
      });
    });
  }

  return {
    adjacency,
    positions,
    method: hasDoorLinks ? "door-aware" : "adjacency"
  };
}

export function buildRoomGraph(version: PlanVersion): RoomGraph {
  const pathGraph = buildPathGraph(version);
  const collapsed = collapsePathGraph(pathGraph, version.rooms);

  if (collapsed.adjacency.size === 0 || [...collapsed.adjacency.values()].every((neighbors) => neighbors.size === 0)) {
    return buildLegacyRoomGraph(version);
  }

  return collapsed;
}

function heuristic(from: Point, to: Point) {
  return Math.hypot(from[0] - to[0], from[1] - to[1]);
}

function edgeCost(from: Point, to: Point) {
  return Math.hypot(from[0] - to[0], from[1] - to[1]);
}

export function findRoomPath(graph: RoomGraph, startId: string, goalId: string): Point[] | undefined {
  if (graph.pathGraph) {
    const route = findPathGraphRoute(graph.pathGraph, startId, goalId);
    return route?.path;
  }

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
  const semanticRoute = computeSemanticEgressForRoom(version, startRoomId);
  if (semanticRoute && semanticRoute.semanticValid) {
    return {
      path: semanticRoute.path,
      distance: semanticRoute.distance,
      exitId: semanticRoute.exitId
    };
  }

  if (graph.pathGraph) {
    const route = findNearestExitPathGraph(graph.pathGraph, version, startRoomId);
    if (route) {
      return route;
    }
  }

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

    const routeDistance = pathLength(path);

    if (!best || routeDistance < best.distance) {
      best = { path, distance: routeDistance, exitId: exit.id };
    }
  });

  return best;
}

export { pathLength };
