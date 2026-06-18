import type { PathGraph, PathGraphMethod, PathGraphNode } from "@/lib/analysis/path-graph";
import { buildPathGraph, findPathGraphRoute, pathLength } from "@/lib/analysis/path-graph";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

export type EgressPathMethod =
  | "semantic-opening-aware"
  | "semantic-door-aware"
  | "semantic-adjacency"
  | "semantic-incomplete"
  | "centroid-fallback";

export interface EgressChainStep {
  kind: "room" | "portal";
  roomId?: string;
  roomType?: Room["type"];
  roomName?: string;
}

export interface SemanticEgressRoute {
  path: Point[];
  distance: number;
  exitId: string;
  exitName: string;
  nodeIds: string[];
  chain: EgressChainStep[];
  semanticValid: boolean;
  method: EgressPathMethod;
  missingLinks: string[];
}

interface EgressSearchState {
  portal: boolean;
  circulation: boolean;
}

function roomNodeId(roomId: string) {
  return `room:${roomId}`;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function isExitRoom(room: Room) {
  return room.type === "stair" || room.type === "elevator";
}

function isOccupiableEgressStart(room: Room) {
  return !["stair", "elevator", "shaft"].includes(room.type);
}

function floorHasCorridor(version: PlanVersion) {
  return version.rooms.some((room) => room.type === "corridor");
}

function circulationSatisfied(state: EgressSearchState, version: PlanVersion) {
  if (state.circulation) {
    return true;
  }

  return !floorHasCorridor(version);
}

function egressMethodFromGraph(method: PathGraphMethod, semanticValid: boolean): EgressPathMethod {
  if (!semanticValid) {
    return "semantic-incomplete";
  }

  if (method === "opening-aware") {
    return "semantic-opening-aware";
  }

  if (method === "door-aware") {
    return "semantic-door-aware";
  }

  return "semantic-adjacency";
}

function initialSearchState(startRoom: Room, version: PlanVersion): EgressSearchState {
  if (startRoom.type === "corridor") {
    return { portal: true, circulation: true };
  }

  if (startRoom.type === "lobby" && !floorHasCorridor(version)) {
    return { portal: true, circulation: true };
  }

  return { portal: false, circulation: false };
}

function requiresPortal(startRoom: Room, version: PlanVersion) {
  if (startRoom.type === "corridor") {
    return false;
  }

  if (startRoom.type === "lobby" && !floorHasCorridor(version)) {
    return false;
  }

  return !["stair", "elevator", "shaft"].includes(startRoom.type);
}

function updateSearchState(
  state: EgressSearchState,
  node: PathGraphNode,
  room: Room | undefined,
  version: PlanVersion
): EgressSearchState {
  const next = { ...state };

  if (node.kind === "portal") {
    next.portal = true;
    return next;
  }

  if (room?.type === "corridor") {
    next.circulation = true;
    return next;
  }

  if (room?.type === "lobby" && !floorHasCorridor(version)) {
    next.circulation = true;
    return next;
  }

  return next;
}

function isSemanticGoal(room: Room, state: EgressSearchState, startRoom: Room, version: PlanVersion) {
  if (!isExitRoom(room)) {
    return false;
  }

  if (!circulationSatisfied(state, version)) {
    return false;
  }

  if (requiresPortal(startRoom, version) && !state.portal) {
    return false;
  }

  return true;
}

function stateKey(nodeId: string, state: EgressSearchState) {
  return `${nodeId}|${state.portal ? 1 : 0}|${state.circulation ? 1 : 0}`;
}

function decodeChain(nodeIds: string[], graph: PathGraph, version: PlanVersion): EgressChainStep[] {
  const roomsById = new Map(version.rooms.map((room) => [room.id, room]));
  const chain: EgressChainStep[] = [];

  nodeIds.forEach((nodeId) => {
    const node = graph.nodes.get(nodeId);
    if (!node) {
      return;
    }

    if (node.kind === "portal") {
      chain.push({ kind: "portal" });
      return;
    }

    const room = node.roomId ? roomsById.get(node.roomId) : undefined;
    if (!room) {
      return;
    }

    chain.push({
      kind: "room",
      roomId: room.id,
      roomType: room.type,
      roomName: room.name
    });
  });

  return chain;
}

function missingSemanticLinks(
  chain: EgressChainStep[],
  startRoom: Room,
  version: PlanVersion,
  semanticValid: boolean
): string[] {
  if (semanticValid) {
    return [];
  }

  const missing: string[] = [];
  const hasPortal = chain.some((step) => step.kind === "portal");
  const hasCorridor = chain.some((step) => step.kind === "room" && step.roomType === "corridor");
  const hasExit = chain.some((step) => step.kind === "room" && (step.roomType === "stair" || step.roomType === "elevator"));

  if (requiresPortal(startRoom, version) && !hasPortal) {
    missing.push("door");
  }

  if (floorHasCorridor(version) && !hasCorridor) {
    missing.push("corridor");
  }

  if (!hasExit) {
    missing.push("stair");
  }

  return missing;
}

function parseStateKey(key: string) {
  const [nodeId, portal, circulation] = key.split("|");
  return {
    nodeId: nodeId!,
    state: {
      portal: portal === "1",
      circulation: circulation === "1"
    } satisfies EgressSearchState
  };
}

function reconstructSemanticRoute(
  cameFrom: Map<string, string>,
  goalKey: string,
  graph: PathGraph,
  version: PlanVersion,
  startRoom: Room,
  graphMethod: PathGraphMethod,
  goalState: EgressSearchState
): SemanticEgressRoute | undefined {
  const nodeIds: string[] = [];
  let current: string | undefined = goalKey;

  while (current) {
    const { nodeId } = parseStateKey(current);
    nodeIds.unshift(nodeId);
    current = cameFrom.get(current);
  }

  const path = nodeIds.map((nodeId) => graph.nodes.get(nodeId)!.point);
  const exitNode = [...nodeIds].reverse().find((nodeId) => graph.nodes.get(nodeId)?.kind === "room");
  const exitRoom = version.rooms.find((room) => roomNodeId(room.id) === exitNode);

  if (!exitRoom || !isExitRoom(exitRoom)) {
    return undefined;
  }

  const chain = decodeChain(nodeIds, graph, version);
  const semanticValid = isSemanticGoal(exitRoom, goalState, startRoom, version);
  const missingLinks = missingSemanticLinks(chain, startRoom, version, semanticValid);

  return {
    path,
    distance: pathLength(path),
    exitId: exitRoom.id,
    exitName: exitRoom.name,
    nodeIds,
    chain,
    semanticValid,
    method: egressMethodFromGraph(graphMethod, semanticValid),
    missingLinks
  };
}

export function findSemanticEgressRoute(
  graph: PathGraph,
  version: PlanVersion,
  startRoomId: string,
  goalRoomId: string
): SemanticEgressRoute | undefined {
  const startRoom = version.rooms.find((room) => room.id === startRoomId);
  const goalRoom = version.rooms.find((room) => room.id === goalRoomId);

  if (!startRoom || !goalRoom || !isExitRoom(goalRoom)) {
    return undefined;
  }

  const startId = roomNodeId(startRoomId);
  const goalId = roomNodeId(goalRoomId);

  if (!graph.nodes.has(startId) || !graph.nodes.has(goalId)) {
    return undefined;
  }

  if (startId === goalId) {
    const chain = decodeChain([startId], graph, version);
    const semanticValid = isSemanticGoal(goalRoom, initialSearchState(startRoom, version), startRoom, version);
    return {
      path: [graph.nodes.get(startId)!.point],
      distance: 0,
      exitId: goalRoom.id,
      exitName: goalRoom.name,
      nodeIds: [startId],
      chain,
      semanticValid,
      method: egressMethodFromGraph(graph.method, semanticValid),
      missingLinks: missingSemanticLinks(chain, startRoom, version, semanticValid)
    };
  }

  const initialState = initialSearchState(startRoom, version);
  const startKey = stateKey(startId, initialState);
  const open = new Set([startKey]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);

  while (open.size > 0) {
    const current = [...open].sort((left, right) => (gScore.get(left) ?? Infinity) - (gScore.get(right) ?? Infinity))[0];
    open.delete(current);

    const { nodeId, state } = parseStateKey(current);
    const node = graph.nodes.get(nodeId);
    const room = node?.roomId ? version.rooms.find((item) => item.id === node.roomId) : undefined;

    if (room && nodeId === goalId && isSemanticGoal(room, state, startRoom, version)) {
      return reconstructSemanticRoute(cameFrom, current, graph, version, startRoom, graph.method, state);
    }

    const neighbors = graph.adjacency.get(nodeId) ?? new Set<string>();

    neighbors.forEach((neighborId) => {
      const neighbor = graph.nodes.get(neighborId);
      if (!neighbor) {
        return;
      }

      const neighborRoom = neighbor.roomId ? version.rooms.find((item) => item.id === neighbor.roomId) : undefined;
      const nextState = updateSearchState(state, neighbor, neighborRoom, version);
      const nextKey = stateKey(neighborId, nextState);
      const edgeDistance = distance(node!.point, neighbor.point);
      const tentativeG = (gScore.get(current) ?? Infinity) + edgeDistance;

      if (tentativeG >= (gScore.get(nextKey) ?? Infinity)) {
        return;
      }

      cameFrom.set(nextKey, current);
      gScore.set(nextKey, tentativeG);
      open.add(nextKey);
    });
  }

  const unconstrained = findPathGraphRoute(graph, startRoomId, goalRoomId);
  if (!unconstrained) {
    return undefined;
  }

  const chain = decodeChain(unconstrained.nodeIds, graph, version);
  const semanticValid = false;

  return {
    path: unconstrained.path,
    distance: unconstrained.distance,
    exitId: goalRoom.id,
    exitName: goalRoom.name,
    nodeIds: unconstrained.nodeIds,
    chain,
    semanticValid,
    method: "semantic-incomplete",
    missingLinks: missingSemanticLinks(chain, startRoom, version, semanticValid)
  };
}

export function findNearestSemanticExitPath(
  graph: PathGraph,
  version: PlanVersion,
  startRoomId: string
): SemanticEgressRoute | undefined {
  const exits = version.rooms.filter((room) => isExitRoom(room));
  let best: SemanticEgressRoute | undefined;

  exits.forEach((exit) => {
    const route = findSemanticEgressRoute(graph, version, startRoomId, exit.id);
    if (!route) {
      return;
    }

    const routeRank = route.semanticValid ? 0 : 1;
    const bestRank = best?.semanticValid ? 0 : 1;

    if (
      !best ||
      routeRank < bestRank ||
      (routeRank === bestRank && route.distance < best.distance)
    ) {
      best = route;
    }
  });

  return best;
}

export function computeSemanticEgressForRoom(
  version: PlanVersion,
  startRoomId: string,
  levelId?: string
): SemanticEgressRoute | undefined {
  const scoped =
    levelId && version.levels.find((level) => level.id === levelId)
      ? {
          ...version,
          rooms: version.levels.find((level) => level.id === levelId)!.rooms,
          levels: [version.levels.find((level) => level.id === levelId)!]
        }
      : version;

  const startRoom = scoped.rooms.find((room) => room.id === startRoomId);
  if (!startRoom || !isOccupiableEgressStart(startRoom)) {
    return undefined;
  }

  const graph = buildPathGraph(scoped);
  const route = findNearestSemanticExitPath(graph, scoped, startRoomId);

  if (route) {
    return route;
  }

  const exits = scoped.rooms.filter((room) => isExitRoom(room));
  if (exits.length === 0) {
    return undefined;
  }

  const coreRoom = exits[0];
  const center = centroid(startRoom);
  const corePoint = centroid(coreRoom);

  return {
    path: [center, corePoint],
    distance: distance(center, corePoint),
    exitId: coreRoom.id,
    exitName: coreRoom.name,
    nodeIds: [],
    chain: [],
    semanticValid: false,
    method: "centroid-fallback",
    missingLinks: ["door", "corridor", "stair"]
  };
}

export function summarizeEgressMethod(routes: SemanticEgressRoute[]): EgressPathMethod {
  if (routes.length === 0) {
    return "centroid-fallback";
  }

  if (routes.every((route) => route.method === "centroid-fallback")) {
    return "centroid-fallback";
  }

  if (routes.some((route) => route.semanticValid && route.method === "semantic-opening-aware")) {
    return "semantic-opening-aware";
  }

  if (routes.some((route) => route.semanticValid && route.method === "semantic-door-aware")) {
    return "semantic-door-aware";
  }

  if (routes.some((route) => route.semanticValid)) {
    return "semantic-adjacency";
  }

  if (routes.some((route) => route.method === "semantic-incomplete")) {
    return "semantic-incomplete";
  }

  return "centroid-fallback";
}

export function egressMethodLabel(method: EgressPathMethod) {
  switch (method) {
    case "semantic-opening-aware":
      return "semantic door-corridor-stair path (opening-aware)";
    case "semantic-door-aware":
      return "semantic door-corridor-stair path (door-aware)";
    case "semantic-adjacency":
      return "semantic door-corridor-stair path (adjacency)";
    case "semantic-incomplete":
      return "incomplete semantic egress chain";
    default:
      return "centroid fallback";
  }
}
