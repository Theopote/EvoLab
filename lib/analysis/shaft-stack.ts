import { buildPathGraph, findPathGraphRoute } from "@/lib/analysis/path-graph";
import { buildRoomGraph, findRoomPath } from "@/lib/analysis/graph";
import type { MepLayout, PlanVersion, Point, Room } from "@/lib/project-types";

const STACK_TOLERANCE_M = 2.5;
const MEP_SNAP_TOLERANCE_M = 3.5;
const SHAFT_ROOM_TYPES = new Set<Room["type"]>(["shaft", "equipment_room"]);

export interface ShaftStack {
  id: string;
  center: Point;
  levelIds: string[];
  roomIds: string[];
  footprintSqm: number;
  multiFloor: boolean;
  source: "rooms" | "mep" | "merged";
}

export type WetStackPathMethod = "stack-path" | "stack-centroid-fallback" | "centroid-fallback";

export interface WetStackPathResult {
  roomId: string;
  roomName: string;
  levelId?: string;
  stackId?: string;
  targetRoomId?: string;
  horizontalPath: Point[];
  horizontalDistance: number;
  verticalAligned: boolean;
  method: WetStackPathMethod;
  missingLinks: string[];
}

export interface WetStackPathMetrics {
  stacks: ShaftStack[];
  averageDistance: number;
  perRoom: WetStackPathResult[];
  stackedShaftCount: number;
  stackCoverage: number;
  shaftAreaSqm: number;
  wetDemandSqm: number;
  shaftCapacityRatio: number;
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function roomLevelId(version: PlanVersion, room: Room) {
  return room.levelId ?? version.levels[0]?.id;
}

function shaftRooms(version: PlanVersion, levelId?: string) {
  const rooms = levelId
    ? version.rooms.filter((room) => (room.levelId ?? version.levels[0]?.id) === levelId)
    : version.rooms;

  return rooms.filter((room) => SHAFT_ROOM_TYPES.has(room.type));
}

function scopeVersion(version: PlanVersion, levelId?: string): PlanVersion {
  if (!levelId) {
    return version;
  }

  const level = version.levels.find((item) => item.id === levelId);
  if (!level) {
    return version;
  }

  return {
    ...version,
    rooms: level.rooms,
    levels: [level]
  };
}

function createStackFromRooms(
  id: string,
  rooms: Room[],
  version: PlanVersion,
  source: ShaftStack["source"]
): ShaftStack {
  const levelIds = [...new Set(rooms.map((room) => roomLevelId(version, room)!).filter(Boolean))];
  const center = rooms.reduce(
    (acc, room) => {
      const point = centroid(room);
      return [acc[0] + point[0], acc[1] + point[1]] as Point;
    },
    [0, 0] as Point
  );
  const divisor = Math.max(1, rooms.length);

  return {
    id,
    center: [center[0] / divisor, center[1] / divisor],
    levelIds,
    roomIds: rooms.map((room) => room.id),
    footprintSqm: rooms.reduce((total, room) => total + room.areaSqm, 0),
    multiFloor: levelIds.length > 1,
    source
  };
}

function mergeStacksByCenter(stacks: ShaftStack[]): ShaftStack[] {
  const merged: ShaftStack[] = [];

  stacks.forEach((stack) => {
    const existing = merged.find((candidate) => distance(candidate.center, stack.center) <= STACK_TOLERANCE_M);

    if (!existing) {
      merged.push(stack);
      return;
    }

    existing.levelIds = [...new Set([...existing.levelIds, ...stack.levelIds])];
    existing.roomIds = [...new Set([...existing.roomIds, ...stack.roomIds])];
    existing.footprintSqm += stack.footprintSqm;
    existing.multiFloor = existing.levelIds.length > 1;
    existing.source = existing.source === stack.source ? existing.source : "merged";
    existing.center = [
      (existing.center[0] + stack.center[0]) / 2,
      (existing.center[1] + stack.center[1]) / 2
    ];
  });

  return merged;
}

function stacksFromRooms(version: PlanVersion): ShaftStack[] {
  const shafts = shaftRooms(version);
  const groups: Room[][] = [];

  shafts.forEach((shaft) => {
    const center = centroid(shaft);
    const existing = groups.find((group) => distance(centroid(group[0]), center) <= STACK_TOLERANCE_M);
    if (existing) {
      existing.push(shaft);
      return;
    }
    groups.push([shaft]);
  });

  return groups.map((rooms, index) => createStackFromRooms(`stack-room-${index + 1}`, rooms, version, "rooms"));
}

function stacksFromMep(version: PlanVersion, mep?: MepLayout): ShaftStack[] {
  if (!mep?.shafts.length) {
    return [];
  }

  return mep.shafts.map((shaft, index) => {
    const alignedRooms = shaftRooms(version).filter((room) => distance(centroid(room), shaft.position) <= MEP_SNAP_TOLERANCE_M);

    if (alignedRooms.length > 0) {
      return createStackFromRooms(`stack-mep-${shaft.id}`, alignedRooms, version, "mep");
    }

    return {
      id: `stack-mep-${shaft.id || index + 1}`,
      center: shaft.position,
      levelIds: version.levels.map((level) => level.id),
      roomIds: [],
      footprintSqm: 4,
      multiFloor: version.levels.length > 1,
      source: "mep" as const
    };
  });
}

export function buildShaftStacks(version: PlanVersion, mep?: MepLayout): ShaftStack[] {
  const roomStacks = stacksFromRooms(version);
  const mepStacks = stacksFromMep(version, mep ?? version.mep);
  return mergeStacksByCenter([...roomStacks, ...mepStacks]).map((stack, index) => ({
    ...stack,
    id: stack.id || `stack-${index + 1}`
  }));
}

function stackRoomsOnLevel(stack: ShaftStack, version: PlanVersion, levelId?: string) {
  const roomsById = new Map(version.rooms.map((room) => [room.id, room]));
  return stack.roomIds
    .map((roomId) => roomsById.get(roomId))
    .filter((room): room is Room => Boolean(room))
    .filter((room) => !levelId || roomLevelId(version, room) === levelId);
}

function horizontalPathToTarget(
  version: PlanVersion,
  startRoomId: string,
  targetRoomId: string
): { path: Point[]; distance: number; method: WetStackPathMethod } {
  const pathGraph = buildPathGraph(version);
  const graphRoute = findPathGraphRoute(pathGraph, startRoomId, targetRoomId);

  if (graphRoute) {
    return {
      path: graphRoute.path,
      distance: graphRoute.distance,
      method: "stack-path"
    };
  }

  const roomGraph = buildRoomGraph(version);
  const legacyPath = findRoomPath(roomGraph, startRoomId, targetRoomId);
  if (legacyPath && legacyPath.length >= 2) {
    const routeDistance = legacyPath.slice(1).reduce((total, point, index) => total + distance(point, legacyPath[index]), 0);
    return {
      path: legacyPath,
      distance: routeDistance,
      method: "stack-path"
    };
  }

  const start = version.rooms.find((room) => room.id === startRoomId);
  const target = version.rooms.find((room) => room.id === targetRoomId);
  if (!start || !target) {
    return { path: [], distance: Infinity, method: "centroid-fallback" };
  }

  const startPoint = centroid(start);
  const targetPoint = centroid(target);
  return {
    path: [startPoint, targetPoint],
    distance: distance(startPoint, targetPoint),
    method: "stack-centroid-fallback"
  };
}

function pickBestStackTarget(
  version: PlanVersion,
  wetRoom: Room,
  stacks: ShaftStack[],
  levelId?: string
) {
  const wetLevelId = levelId ?? roomLevelId(version, wetRoom);
  let best:
    | {
        stack: ShaftStack;
        targetRoom: Room;
        route: ReturnType<typeof horizontalPathToTarget>;
      }
    | undefined;

  stacks.forEach((stack) => {
    const candidates = stackRoomsOnLevel(stack, version, wetLevelId);
    const targetRoom =
      candidates[0] ??
      stackRoomsOnLevel(stack, version)[0];

    if (!targetRoom) {
      if (stack.source === "mep") {
        const fallbackDistance = distance(centroid(wetRoom), stack.center);
        const route = {
          path: [centroid(wetRoom), stack.center],
          distance: fallbackDistance,
          method: "stack-centroid-fallback" as const
        };

        if (!best || route.distance < best.route.distance) {
          best = {
            stack,
            targetRoom: wetRoom,
            route
          };
        }
      }
      return;
    }

    const route = horizontalPathToTarget(version, wetRoom.id, targetRoom.id);
    if (!Number.isFinite(route.distance)) {
      return;
    }

    const verticalBonus = stack.multiFloor ? -0.5 : 0;
    const rankedDistance = route.distance + verticalBonus;
    const bestRankedDistance = best ? best.route.distance + (best.stack.multiFloor ? -0.5 : 0) : Infinity;

    if (!best || rankedDistance < bestRankedDistance) {
      best = { stack, targetRoom, route };
    }
  });

  return best;
}

function missingStackLinks(result: WetStackPathResult) {
  const missing: string[] = [];

  if (result.method !== "stack-path") {
    missing.push("horizontal-path");
  }

  if (!result.verticalAligned && result.stackId) {
    missing.push("vertical-stack");
  }

  if (!result.stackId) {
    missing.push("shaft-stack");
  }

  return missing;
}

export function computeWetRoomToStackPath(
  version: PlanVersion,
  wetRoom: Room,
  stacks: ShaftStack[],
  levelId?: string
): WetStackPathResult {
  const best = pickBestStackTarget(version, wetRoom, stacks, levelId);

  if (!best) {
    const fallbackDistance = 14;
    return {
      roomId: wetRoom.id,
      roomName: wetRoom.name,
      levelId: levelId ?? roomLevelId(version, wetRoom),
      horizontalPath: [],
      horizontalDistance: fallbackDistance,
      verticalAligned: false,
      method: "centroid-fallback",
      missingLinks: ["shaft-stack", "horizontal-path", "vertical-stack"]
    };
  }

  const wetLevelId = levelId ?? roomLevelId(version, wetRoom);
  const verticalAligned =
    best.stack.multiFloor &&
    best.stack.levelIds.includes(wetLevelId ?? "") &&
    best.route.method === "stack-path";

  const result: WetStackPathResult = {
    roomId: wetRoom.id,
    roomName: wetRoom.name,
    levelId: wetLevelId,
    stackId: best.stack.id,
    targetRoomId: best.targetRoom.id,
    horizontalPath: best.route.path,
    horizontalDistance: best.route.distance,
    verticalAligned,
    method: best.route.method,
    missingLinks: []
  };

  result.missingLinks = missingStackLinks(result);
  return result;
}

export function computeWetStackPathMetrics(version: PlanVersion, levelId?: string): WetStackPathMetrics {
  const scoped = scopeVersion(version, levelId);
  const stacks = buildShaftStacks(version, version.mep);
  const wetRooms = scoped.rooms.filter((room) => room.needsPlumbing);
  const perRoom = wetRooms.map((room) => computeWetRoomToStackPath(scoped, room, stacks, levelId));
  const shaftAreaSqm = stacks.reduce((total, stack) => total + stack.footprintSqm, 0);
  const wetAreaSqm = wetRooms.reduce((total, room) => total + room.areaSqm, 0);
  const wetDemandSqm = wetAreaSqm * 0.08 + wetRooms.length * 2;
  const shaftCapacityRatio = wetDemandSqm > 0 ? shaftAreaSqm / wetDemandSqm : shaftAreaSqm > 0 ? 1.5 : 0;
  const multiFloorStacks = stacks.filter((stack) => stack.multiFloor);
  const averageDistance =
    perRoom.length > 0 ? perRoom.reduce((total, item) => total + item.horizontalDistance, 0) / perRoom.length : 0;

  return {
    stacks,
    averageDistance,
    perRoom,
    stackedShaftCount: multiFloorStacks.reduce((total, stack) => total + stack.roomIds.length, 0),
    stackCoverage: stacks.length > 0 ? multiFloorStacks.length / stacks.length : 0,
    shaftAreaSqm,
    wetDemandSqm,
    shaftCapacityRatio
  };
}
