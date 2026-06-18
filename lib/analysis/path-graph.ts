import type { OpeningElement, PlanVersion, Point, Room, Wall } from "@/lib/project-types";
import { edgeKey, extractWallsFromRooms, polygonEdges } from "@/lib/wall-extractor";

export type PathGraphMethod = "opening-aware" | "door-aware" | "adjacency";

export interface PathGraphNode {
  id: string;
  point: Point;
  kind: "room" | "portal";
  roomId?: string;
}

export interface PathGraph {
  nodes: Map<string, PathGraphNode>;
  adjacency: Map<string, Set<string>>;
  method: PathGraphMethod;
}

const VESTIBULE_TYPES = new Set<Room["type"]>(["corridor", "lobby"]);

function roomNodeId(roomId: string) {
  return `room:${roomId}`;
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
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

function resolveLevelGeometry(version: PlanVersion) {
  const level = version.levels[0];
  const walls = level?.walls?.length ? level.walls : extractWallsFromRooms(version.rooms, version.outline);
  const openings = level?.openings ?? [];
  return { walls, openings };
}

function portalDedupeKey(opening: OpeningElement) {
  return `${opening.wallId}:${Math.round(opening.center[0] * 10)}:${Math.round(opening.center[1] * 10)}`;
}

function connectedRoomIds(opening: OpeningElement, wall?: Wall) {
  const fromWall = wall?.roomIds ?? [];
  const fromOpening = opening.roomIds ?? [];
  return [...new Set([...fromWall, ...fromOpening])];
}

function inferLegacyDoorPortals(
  version: PlanVersion,
  walls: Wall[],
  nodes: Map<string, PathGraphNode>,
  adjacency: Map<string, Set<string>>
) {
  const wallsByKey = new Map(walls.map((wall) => [edgeKey(wall.start, wall.end), wall]));
  let linked = false;

  version.rooms.forEach((room) => {
    room.doors.forEach((door, index) => {
      const edges = polygonEdges(room.polygon);
      const edge =
        edges.find((candidate) => {
          const wall = wallsByKey.get(candidate.key);
          return wall && wall.roomIds.includes(room.id);
        }) ?? edges[0];

      if (!edge) {
        return;
      }

      const wall = wallsByKey.get(edge.key);
      if (!wall) {
        return;
      }

      const portalId = `portal:legacy-${room.id}-${index}`;
      const center: Point = [
        wall.start[0] + (wall.end[0] - wall.start[0]) * door.position,
        wall.start[1] + (wall.end[1] - wall.start[1]) * door.position
      ];

      nodes.set(portalId, { id: portalId, point: center, kind: "portal", roomId: room.id });
      adjacency.set(portalId, new Set());
      connect(adjacency, portalId, roomNodeId(room.id));

      wall.roomIds.forEach((roomId) => {
        connect(adjacency, portalId, roomNodeId(roomId));
      });

      linked = true;
    });
  });

  return linked;
}

function inferSharedEdgeAdjacency(rooms: Room[], adjacency: Map<string, Set<string>>) {
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
        connect(adjacency, roomNodeId(owners[index]), roomNodeId(owners[other]));
      }
    }
  });
}

function inferVestibuleLinks(version: PlanVersion, adjacency: Map<string, Set<string>>) {
  const vestibules = version.rooms.filter((room) => VESTIBULE_TYPES.has(room.type));
  const exits = version.rooms.filter((room) => room.type === "stair" || room.type === "elevator");

  vestibules.forEach((vestibule) => {
    exits.forEach((exit) => {
      if (vestibule.adjacents?.includes(exit.id) || exit.adjacents?.includes(vestibule.id)) {
        connect(adjacency, roomNodeId(vestibule.id), roomNodeId(exit.id));
      }
    });

    version.rooms.forEach((room) => {
      if (room.id === vestibule.id || exits.some((exit) => exit.id === room.id)) {
        return;
      }

      if (vestibule.adjacents?.includes(room.id) || room.adjacents?.includes(vestibule.id)) {
        connect(adjacency, roomNodeId(vestibule.id), roomNodeId(room.id));
      }
    });
  });
}

function inferCorridorHeuristicLinks(version: PlanVersion, adjacency: Map<string, Set<string>>, nodes: Map<string, PathGraphNode>) {
  const corridors = version.rooms.filter((room) => room.type === "corridor");

  corridors.forEach((corridor) => {
    version.rooms.forEach((room) => {
      if (room.id === corridor.id) {
        return;
      }

      const corridorNeighbors = adjacency.get(roomNodeId(corridor.id));
      if (corridorNeighbors?.has(roomNodeId(room.id))) {
        return;
      }

      const corridorPoint = nodes.get(roomNodeId(corridor.id))?.point;
      const roomPoint = nodes.get(roomNodeId(room.id))?.point;
      if (!corridorPoint || !roomPoint) {
        return;
      }

      const span = distance(corridorPoint, roomPoint);
      if (span < Math.max(8, Math.sqrt(room.areaSqm) * 1.4) && (room.doors.length > 0 || room.type === "corridor")) {
        connect(adjacency, roomNodeId(corridor.id), roomNodeId(room.id));
      }
    });
  });
}

export function buildPathGraph(version: PlanVersion): PathGraph {
  const nodes = new Map<string, PathGraphNode>();
  const adjacency = new Map<string, Set<string>>();

  version.rooms.forEach((room) => {
    const id = roomNodeId(room.id);
    nodes.set(id, { id, point: centroid(room), kind: "room", roomId: room.id });
    adjacency.set(id, new Set());
  });

  const { walls, openings } = resolveLevelGeometry(version);
  const wallsById = new Map(walls.map((wall) => [wall.id, wall]));
  const portalGroups = new Map<string, { opening: OpeningElement; roomIds: Set<string> }>();

  openings
    .filter((opening) => opening.type === "door")
    .forEach((opening) => {
      const wall = wallsById.get(opening.wallId);
      const key = portalDedupeKey(opening);
      const existing = portalGroups.get(key);

      if (existing) {
        connectedRoomIds(opening, wall).forEach((roomId) => existing.roomIds.add(roomId));
        return;
      }

      portalGroups.set(key, {
        opening,
        roomIds: new Set(connectedRoomIds(opening, wall))
      });
    });

  portalGroups.forEach(({ opening, roomIds }, key) => {
    const portalId = `portal:${opening.id || key}`;
    nodes.set(portalId, { id: portalId, point: opening.center, kind: "portal", roomId: opening.roomIds?.[0] });
    adjacency.set(portalId, new Set());

    roomIds.forEach((roomId) => {
      if (!nodes.has(roomNodeId(roomId))) {
        return;
      }

      connect(adjacency, portalId, roomNodeId(roomId));
    });
  });

  let method: PathGraphMethod = portalGroups.size > 0 ? "opening-aware" : "adjacency";

  if (portalGroups.size === 0) {
    const hasLegacyPortals = inferLegacyDoorPortals(version, walls, nodes, adjacency);
    if (hasLegacyPortals) {
      method = "door-aware";
    } else {
      version.rooms.forEach((room) => {
        (room.adjacents ?? []).forEach((adjacentId) => connect(adjacency, roomNodeId(room.id), roomNodeId(adjacentId)));
      });
      inferSharedEdgeAdjacency(version.rooms, adjacency);
      inferCorridorHeuristicLinks(version, adjacency, nodes);
    }
  }

  inferVestibuleLinks(version, adjacency);

  return { nodes, adjacency, method };
}

function heuristic(from: Point, to: Point) {
  return distance(from, to);
}

function reconstructPath(cameFrom: Map<string, string>, current: string) {
  const nodeIds = [current];

  while (cameFrom.has(nodeIds[0])) {
    nodeIds.unshift(cameFrom.get(nodeIds[0])!);
  }

  return nodeIds;
}

export function findPathGraphRoute(
  graph: PathGraph,
  startRoomId: string,
  goalRoomId: string
): { path: Point[]; distance: number; nodeIds: string[] } | undefined {
  const startId = roomNodeId(startRoomId);
  const goalId = roomNodeId(goalRoomId);

  if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) {
    return undefined;
  }

  if (startId === goalId) {
    const point = graph.nodes.get(startId)!.point;
    return { path: [point], distance: 0, nodeIds: [startId] };
  }

  const open = new Set([startId]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startId, 0]]);
  const goalPoint = graph.nodes.get(goalId)!.point;
  const fScore = new Map<string, number>([[startId, heuristic(graph.nodes.get(startId)!.point, goalPoint)]]);

  while (open.size > 0) {
    const current = [...open].sort((a, b) => (fScore.get(a) ?? Infinity) - (fScore.get(b) ?? Infinity))[0];
    open.delete(current);

    if (current === goalId) {
      const nodeIds = reconstructPath(cameFrom, current);
      const path = nodeIds.map((nodeId) => graph.nodes.get(nodeId)!.point);
      const routeDistance = path.slice(1).reduce((total, point, index) => total + distance(path[index], point), 0);

      return { path, distance: routeDistance, nodeIds };
    }

    const neighbors = graph.adjacency.get(current) ?? new Set<string>();

    neighbors.forEach((neighborId) => {
      const currentPoint = graph.nodes.get(current)?.point;
      const neighborPoint = graph.nodes.get(neighborId)?.point;

      if (!currentPoint || !neighborPoint) {
        return;
      }

      const tentativeG = (gScore.get(current) ?? Infinity) + distance(currentPoint, neighborPoint);

      if (tentativeG >= (gScore.get(neighborId) ?? Infinity)) {
        return;
      }

      cameFrom.set(neighborId, current);
      gScore.set(neighborId, tentativeG);
      fScore.set(neighborId, tentativeG + heuristic(neighborPoint, goalPoint));
      open.add(neighborId);
    });
  }

  return undefined;
}

export function findNearestExitPathGraph(
  graph: PathGraph,
  version: PlanVersion,
  startRoomId: string
): { path: Point[]; distance: number; exitId: string; nodeIds: string[] } | undefined {
  const exits = version.rooms.filter((room) => room.type === "stair" || room.type === "elevator");

  if (exits.length === 0) {
    return undefined;
  }

  let best: { path: Point[]; distance: number; exitId: string; nodeIds: string[] } | undefined;

  exits.forEach((exit) => {
    const route = findPathGraphRoute(graph, startRoomId, exit.id);

    if (!route || route.path.length < 1) {
      return;
    }

    if (!best || route.distance < best.distance) {
      best = { ...route, exitId: exit.id };
    }
  });

  return best;
}

export function pathLength(points: Point[]) {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}
