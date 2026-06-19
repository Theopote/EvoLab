import type { CopilotFinding, MepLayout, MepRoute, MepShaft, MepSystemType, PlanVersion, Point, Room } from "@/lib/project-types";
import { resolveLevelRooms } from "@/lib/level-rooms";
import { scopeVersionForLevel } from "@/lib/plan-scope";

const SYSTEMS: MepSystemType[] = ["hvac", "plumbing_supply", "plumbing_drain", "electrical", "elv", "fire"];
const GRID_STEP = 1.5;

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  key: string;
  parent?: string;
}

interface RoutingResult {
  mep: MepLayout;
  findings: CopilotFinding[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function centroidFromPoints(points: Point[]): Point {
  const total = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / Math.max(1, points.length), total[1] / Math.max(1, points.length)];
}

function centroid(room: Room): Point {
  return centroidFromPoints(room.polygon);
}

function pointInPolygon(point: Point, polygon: Point[]) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInAnyRoom(point: Point, rooms: Room[]) {
  return rooms.some((room) => pointInPolygon(point, room.polygon));
}

function key(x: number, y: number) {
  return `${x},${y}`;
}

function snap(point: Point, step: number): Point {
  return [Math.round(point[0] / step) * step, Math.round(point[1] / step) * step];
}

function nearestWalkable(point: Point, isWalkable: (point: Point) => boolean, width: number, height: number, step: number) {
  const snapped = snap(point, step);

  if (isWalkable(snapped)) {
    return snapped;
  }

  const maxRadius = Math.ceil(Math.max(width, height) / step);

  for (let radius = 1; radius <= maxRadius; radius++) {
    let best: Point | null = null;
    let bestDistance = Infinity;

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
          continue;
        }

        const candidate: Point = [snapped[0] + dx * step, snapped[1] + dy * step];

        if (candidate[0] < 0 || candidate[0] > width || candidate[1] < 0 || candidate[1] > height || !isWalkable(candidate)) {
          continue;
        }

        const candidateDistance = distance(point, candidate);
        if (candidateDistance < bestDistance) {
          best = candidate;
          bestDistance = candidateDistance;
        }
      }
    }

    if (best) {
      return best;
    }
  }

  return snapped;
}

function reconstructPath(nodes: Map<string, Node>, currentKey: string): Point[] {
  const path: Point[] = [];
  let cursor: string | undefined = currentKey;

  while (cursor) {
    const node = nodes.get(cursor);
    if (!node) {
      break;
    }

    path.unshift([node.x, node.y]);
    cursor = node.parent;
  }

  return simplifyPath(path);
}

function simplifyPath(path: Point[]) {
  if (path.length <= 2) {
    return path;
  }

  const simplified: Point[] = [path[0]];
  let previousDirection: Point | null = null;

  for (let index = 1; index < path.length; index++) {
    const previous = path[index - 1];
    const current = path[index];
    const direction: Point = [Math.sign(current[0] - previous[0]), Math.sign(current[1] - previous[1])];

    if (previousDirection && (direction[0] !== previousDirection[0] || direction[1] !== previousDirection[1])) {
      simplified.push(previous);
    }

    previousDirection = direction;
  }

  simplified.push(path[path.length - 1]);
  return simplified;
}

function routeAStar(version: PlanVersion, start: Point, goal: Point, walkableRooms: Room[]) {
  const width = version.overallBounds.width;
  const height = version.overallBounds.height;
  const isWalkable = (point: Point) => {
    if (point[0] < 0 || point[0] > width || point[1] < 0 || point[1] > height) {
      return false;
    }

    if (!pointInPolygon(point, version.outline)) {
      return false;
    }

    return walkableRooms.length === 0 || pointInAnyRoom(point, walkableRooms);
  };

  const snappedStart = nearestWalkable(start, isWalkable, width, height, GRID_STEP);
  const snappedGoal = nearestWalkable(goal, isWalkable, width, height, GRID_STEP);
  const startKey = key(snappedStart[0], snappedStart[1]);
  const goalKey = key(snappedGoal[0], snappedGoal[1]);
  const open = new Map<string, Node>([
    [
      startKey,
      {
        x: snappedStart[0],
        y: snappedStart[1],
        g: 0,
        f: distance(snappedStart, snappedGoal),
        key: startKey
      }
    ]
  ]);
  const visited = new Set<string>();
  const nodes = new Map<string, Node>(open);
  const directions: Point[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  while (open.size > 0 && visited.size < 8000) {
    const current = [...open.values()].sort((a, b) => a.f - b.f)[0];
    open.delete(current.key);

    if (current.key === goalKey) {
      return reconstructPath(nodes, current.key);
    }

    visited.add(current.key);

    for (const [dx, dy] of directions) {
      const nextPoint: Point = [current.x + dx * GRID_STEP, current.y + dy * GRID_STEP];
      const nextKey = key(nextPoint[0], nextPoint[1]);

      if (visited.has(nextKey) || !isWalkable(nextPoint)) {
        continue;
      }

      const g = current.g + GRID_STEP;
      const existing = nodes.get(nextKey);

      if (existing && existing.g <= g) {
        continue;
      }

      const node: Node = {
        x: nextPoint[0],
        y: nextPoint[1],
        g,
        f: g + distance(nextPoint, snappedGoal),
        key: nextKey,
        parent: current.key
      };
      nodes.set(nextKey, node);
      open.set(nextKey, node);
    }
  }

  return simplifyPath([start, [goal[0], start[1]], goal]);
}

function routeRoomsForSystem(version: PlanVersion, system: MepSystemType) {
  if (system === "plumbing_supply" || system === "plumbing_drain") {
    return version.rooms.filter((room) => room.needsPlumbing || room.type === "equipment_room" || room.type === "shaft");
  }

  if (system === "hvac") {
    return version.rooms.filter((room) => room.type !== "shaft");
  }

  if (system === "electrical" || system === "elv" || system === "fire") {
    return version.rooms.filter((room) => room.type !== "shaft");
  }

  return version.rooms;
}

function walkableRoomsForSystem(version: PlanVersion, system: MepSystemType) {
  const serviceRooms = version.rooms.filter((room) => ["corridor", "shaft", "equipment_room"].includes(room.type) || room.zone === "service");
  if (serviceRooms.length > 0) {
    return serviceRooms;
  }

  if (system === "plumbing_supply" || system === "plumbing_drain") {
    return routeRoomsForSystem(version, system);
  }

  return version.rooms;
}

function choosePrimaryShaft(version: PlanVersion, seed?: MepLayout) {
  const seedShaft = seed?.shafts[0]?.position;
  if (seedShaft) {
    return seedShaft;
  }

  const groundLevel = version.levels[0];
  const groundRooms = groundLevel ? resolveLevelRooms(groundLevel, version.standardFloorGroups) : version.rooms;
  const shaftRoom = groundRooms.find((room) => room.type === "shaft") ?? version.rooms.find((room) => room.type === "shaft");
  if (shaftRoom) {
    return centroid(shaftRoom);
  }

  const equipmentRoom =
    groundRooms.find((room) => room.type === "equipment_room") ?? version.rooms.find((room) => room.type === "equipment_room");
  if (equipmentRoom) {
    return centroid(equipmentRoom);
  }

  return [version.overallBounds.width * 0.72, version.overallBounds.height * 0.5] as Point;
}

function chooseRouteGoal(version: PlanVersion, system: MepSystemType, targetRooms: Room[]) {
  const corridors = version.rooms.filter((room) => room.type === "corridor");

  if (corridors.length > 0) {
    const targetCenter = targetRooms.length ? centroidFromPoints(targetRooms.map(centroid)) : [version.overallBounds.width * 0.5, version.overallBounds.height * 0.5] as Point;
    return centroid(corridors.sort((a, b) => distance(centroid(a), targetCenter) - distance(centroid(b), targetCenter))[0]);
  }

  if (targetRooms.length > 0) {
    return centroidFromPoints(targetRooms.map(centroid));
  }

  return [version.overallBounds.width * 0.35, version.overallBounds.height * 0.5] as Point;
}

function offsetPath(path: Point[], index: number) {
  const offset = (index - 2.5) * 0.28;
  return path.map(([x, y], pointIndex) => {
    if (pointIndex === 0 || pointIndex === path.length - 1) {
      return [x, y] as Point;
    }

    return [x, y + offset] as Point;
  });
}

function routeLevelSystems(
  scopedVersion: PlanVersion,
  levelId: string,
  primaryShaft: Point,
  systems: MepSystemType[],
  seed?: MepLayout
): MepRoute[] {
  return systems.map((system, index): MepRoute => {
    const targetRooms = routeRoomsForSystem(scopedVersion, system);
    const goal = chooseRouteGoal(scopedVersion, system, targetRooms);
    const walkableRooms = walkableRoomsForSystem(scopedVersion, system);
    const path = offsetPath(routeAStar(scopedVersion, primaryShaft, goal, walkableRooms), index);
    const seedRoute = seed?.routes.find((route) => route.system === system && (!route.levelId || route.levelId === levelId));

    return {
      id: seedRoute?.id ?? `${levelId}-route-${system}`,
      levelId,
      system,
      path,
      connectsRoomIds: targetRooms.map((room) => room.id)
    };
  });
}

function routeSingleLevel(version: PlanVersion, seed?: MepLayout): MepLayout {
  const levelId = version.levels[0]?.id ?? "level-01";
  const primaryShaft = choosePrimaryShaft(version, seed);
  const seedSystems = seed?.shafts[0]?.systems?.length ? seed.shafts[0].systems : SYSTEMS;
  const systems = Array.from(new Set(seedSystems.filter((system): system is MepSystemType => SYSTEMS.includes(system))));

  return {
    shafts: [
      {
        id: seed?.shafts[0]?.id ?? "mep-shaft-01",
        position: primaryShaft,
        systems,
        levelIds: [levelId]
      }
    ],
    routes: routeLevelSystems(version, levelId, primaryShaft, systems, seed),
    strategy: seed?.strategy
  };
}

export function routeMepLayout(version: PlanVersion, seed?: MepLayout): MepLayout {
  if (version.levels.length <= 1) {
    const scoped = version.levels[0] ? scopeVersionForLevel(version, version.levels[0].id) : version;
    return routeSingleLevel(scoped, seed);
  }

  const primaryShaft = choosePrimaryShaft(version, seed);
  const seedSystems = seed?.shafts[0]?.systems?.length ? seed.shafts[0].systems : SYSTEMS;
  const systems = Array.from(new Set(seedSystems.filter((system): system is MepSystemType => SYSTEMS.includes(system))));
  const levelIds = version.levels.map((level) => level.id);
  const routes = version.levels.flatMap((level) => {
    const scoped = scopeVersionForLevel(version, level.id);
    return routeLevelSystems(scoped, level.id, primaryShaft, systems, seed);
  });

  const shafts: MepShaft[] = [
    {
      id: seed?.shafts[0]?.id ?? "mep-shaft-stack-01",
      position: primaryShaft,
      systems,
      levelIds
    }
  ];

  return {
    shafts,
    routes,
    strategy: seed?.strategy ?? {
      systemConcept: "Stacked primary riser with per-floor horizontal distribution",
      shaftLogic: "One vertical shaft stack aligned to ground-floor service/core rooms",
      routingLogic: "Corridor-first A* routing independently on each floor plate",
      assumptions: [`${version.levels.length} floor(s) share riser XY at ${primaryShaft.map((value) => value.toFixed(1)).join(", ")}`]
    }
  };
}

export function generateRuleBasedMep(version: PlanVersion, seed?: MepLayout): RoutingResult {
  const mep = routeMepLayout(version, seed);
  const wetRooms = version.levels.flatMap((level) =>
    resolveLevelRooms(level, version.standardFloorGroups).filter((room) => room.needsPlumbing)
  );
  const corridorCount = version.levels.reduce((total, level) => {
    return total + resolveLevelRooms(level, version.standardFloorGroups).filter((room) => room.type === "corridor").length;
  }, 0);

  return {
    mep,
    findings: [
      {
        id: "mep-routing",
        tone: "success",
        text:
          version.levels.length > 1
            ? "MEP routes were generated per floor with a shared vertical riser stack."
            : "MEP routes were generated with deterministic corridor-first routing.",
        sub: `${mep.routes.length} route(s) across ${version.levels.length} floor(s); ${corridorCount ? "corridor/service rooms" : "plan outline"} constrain routing.`
      },
      {
        id: "mep-plumbing",
        tone: wetRooms.length ? "info" : "warning",
        text: wetRooms.length ? "Wet rooms are connected to the primary riser strategy." : "No wet rooms were marked for plumbing demand.",
        sub: wetRooms.length ? `${wetRooms.length} room(s) require plumbing service.` : "Mark bathrooms, kitchens or clinical rooms with needsPlumbing for better routes."
      }
    ]
  };
}

export function routesForLevel(mep: MepLayout, levelId?: string) {
  if (!levelId) {
    return mep.routes;
  }

  return mep.routes.filter((route) => !route.levelId || route.levelId === levelId);
}
