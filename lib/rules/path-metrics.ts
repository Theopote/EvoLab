import { buildPathGraph, findNearestExitPathGraph, findPathGraphRoute } from "@/lib/analysis/path-graph";
import { buildRoomGraph, findNearestExitPath, findRoomPath } from "@/lib/analysis/graph";
import type { PathGraphMethod } from "@/lib/analysis/path-graph";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

export type EgressPathMethod = "opening-aware-path" | "door-aware-path" | "path" | "centroid-fallback";

export interface EgressPathResult {
  maxDistance: number;
  worstRoomId?: string;
  worstRoomName?: string;
  method: EgressPathMethod;
  perRoom: Array<{ roomId: string; roomName: string; distance: number; method: EgressPathMethod }>;
}

export interface WetCoreVerticalMetrics {
  stackGroups: number;
  stackCoverage: number;
  stackedShaftCount: number;
  shaftAreaSqm: number;
  wetDemandSqm: number;
  shaftCapacityRatio: number;
}

export interface WetCorePathResult {
  averageDistance: number;
  perRoom: Array<{ roomId: string; roomName: string; distance: number; method: "path" | "centroid-fallback" }>;
  stackedShaftCount: number;
  vertical: WetCoreVerticalMetrics;
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function nearestCorePoint(version: PlanVersion): Point {
  const coreRoom = version.rooms.find((room) => ["stair", "elevator", "shaft"].includes(room.type));
  return coreRoom ? centroid(coreRoom) : [version.overallBounds.width / 2, version.overallBounds.height / 2];
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

function egressMethodFromGraph(method: PathGraphMethod): EgressPathMethod {
  if (method === "opening-aware") {
    return "opening-aware-path";
  }

  if (method === "door-aware") {
    return "door-aware-path";
  }

  return "path";
}

function shortestPathDistance(
  scoped: PlanVersion,
  startRoomId: string,
  targetRoomIds: string[]
): { distance: number; method: "path" | "centroid-fallback" } {
  const pathGraph = buildPathGraph(scoped);
  let best = Infinity;
  let method: "path" | "centroid-fallback" = "centroid-fallback";

  targetRoomIds.forEach((targetId) => {
    const route = findPathGraphRoute(pathGraph, startRoomId, targetId);

    if (route) {
      if (route.distance < best) {
        best = route.distance;
        method = "path";
      }
      return;
    }

    const roomGraph = buildRoomGraph(scoped);
    const legacyRoute = findRoomPath(roomGraph, startRoomId, targetId);

    if (legacyRoute && legacyRoute.length >= 2) {
      const pathDistance = legacyRoute.slice(1).reduce((total, point, index) => {
        const previous = legacyRoute[index];
        return total + distance(point, previous);
      }, 0);

      if (pathDistance < best) {
        best = pathDistance;
        method = "path";
      }
      return;
    }

    const start = scoped.rooms.find((room) => room.id === startRoomId);
    const target = scoped.rooms.find((room) => room.id === targetId);
    if (!start || !target) {
      return;
    }

    const fallbackDistance = distance(centroid(start), centroid(target));
    if (fallbackDistance < best) {
      best = fallbackDistance;
      method = "centroid-fallback";
    }
  });

  return {
    distance: Number.isFinite(best) ? best : Infinity,
    method
  };
}

export function computeEgressPathMetrics(version: PlanVersion, levelId?: string): EgressPathResult {
  const scoped = scopeVersion(version, levelId);
  const pathGraph = buildPathGraph(scoped);
  const pathMethod = egressMethodFromGraph(pathGraph.method);
  const occupiableRooms = scoped.rooms.filter((room) => !["stair", "elevator", "shaft"].includes(room.type));
  const perRoom: EgressPathResult["perRoom"] = [];
  let maxDistance = 0;
  let worstRoomId: string | undefined;
  let worstRoomName: string | undefined;
  let method: EgressPathResult["method"] = pathMethod;

  occupiableRooms.forEach((room) => {
    const route = findNearestExitPathGraph(pathGraph, scoped, room.id);

    if (route) {
      perRoom.push({
        roomId: room.id,
        roomName: room.name,
        distance: route.distance,
        method: pathMethod
      });

      if (route.distance > maxDistance) {
        maxDistance = route.distance;
        worstRoomId = room.id;
        worstRoomName = room.name;
      }
      return;
    }

    const roomGraph = buildRoomGraph(scoped);
    const legacyRoute = findNearestExitPath(roomGraph, scoped, room.id);

    if (legacyRoute) {
      perRoom.push({
        roomId: room.id,
        roomName: room.name,
        distance: legacyRoute.distance,
        method: pathMethod === "opening-aware-path" ? "door-aware-path" : pathMethod
      });

      if (legacyRoute.distance > maxDistance) {
        maxDistance = legacyRoute.distance;
        worstRoomId = room.id;
        worstRoomName = room.name;
      }
      return;
    }

    const corePoint = nearestCorePoint(scoped);
    const center = centroid(room);
    const fallbackDistance = distance(center, corePoint);
    perRoom.push({
      roomId: room.id,
      roomName: room.name,
      distance: fallbackDistance,
      method: "centroid-fallback"
    });
    method = "centroid-fallback";

    if (fallbackDistance > maxDistance) {
      maxDistance = fallbackDistance;
      worstRoomId = room.id;
      worstRoomName = room.name;
    }
  });

  return {
    maxDistance,
    worstRoomId,
    worstRoomName,
    method: perRoom.some((item) => item.method !== "centroid-fallback") ? method : "centroid-fallback",
    perRoom
  };
}

function countStackedShafts(version: PlanVersion, shaftRooms: Room[]) {
  if (version.levels.length <= 1 || shaftRooms.length === 0) {
    return 0;
  }

  const tolerance = 2.5;
  let stacked = 0;

  shaftRooms.forEach((shaft) => {
    const shaftCenter = centroid(shaft);
    const levelId = shaft.levelId ?? version.levels[0]?.id;
    const alignedOnOtherLevels = version.levels
      .filter((level) => level.id !== levelId)
      .some((level) =>
        level.rooms
          .filter((room) => room.type === "shaft" || room.type === "equipment_room")
          .some((other) => distance(centroid(other), shaftCenter) <= tolerance)
      );

    if (alignedOnOtherLevels) {
      stacked += 1;
    }
  });

  return stacked;
}

function groupVerticalShaftStacks(version: PlanVersion) {
  const tolerance = 2.5;
  const shafts = version.rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const groups: Array<{ center: Point; levelIds: Set<string>; roomIds: string[] }> = [];

  shafts.forEach((shaft) => {
    const center = centroid(shaft);
    const levelId = shaft.levelId ?? version.levels[0]?.id ?? "level-01";
    const existing = groups.find((group) => distance(group.center, center) <= tolerance);

    if (existing) {
      existing.levelIds.add(levelId);
      existing.roomIds.push(shaft.id);
      return;
    }

    groups.push({
      center,
      levelIds: new Set([levelId]),
      roomIds: [shaft.id]
    });
  });

  return { groups, totalShafts: shafts.length };
}

function computeShaftCapacity(version: PlanVersion, levelId?: string) {
  const scoped = scopeVersion(version, levelId);
  const shaftRooms = scoped.rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const wetRooms = scoped.rooms.filter((room) => room.needsPlumbing);
  const shaftAreaSqm = shaftRooms.reduce((total, room) => total + room.areaSqm, 0);
  const wetAreaSqm = wetRooms.reduce((total, room) => total + room.areaSqm, 0);
  const wetDemandSqm = wetAreaSqm * 0.08 + wetRooms.length * 2;
  const shaftCapacityRatio = wetDemandSqm > 0 ? shaftAreaSqm / wetDemandSqm : shaftAreaSqm > 0 ? 1.5 : 0;

  return {
    shaftAreaSqm,
    wetDemandSqm,
    shaftCapacityRatio
  };
}

export function computeWetCoreVerticalMetrics(version: PlanVersion, levelId?: string): WetCoreVerticalMetrics {
  const scoped = scopeVersion(version, levelId);
  const { groups, totalShafts } = groupVerticalShaftStacks(version);
  const stackedShaftCount = countStackedShafts(version, scoped.rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room"));
  const multiFloorGroups = groups.filter((group) => group.levelIds.size > 1);
  const stackCoverage = totalShafts > 0 ? multiFloorGroups.length / Math.max(1, groups.length) : 0;
  const capacity = computeShaftCapacity(version, levelId);

  return {
    stackGroups: groups.length,
    stackCoverage,
    stackedShaftCount,
    shaftAreaSqm: capacity.shaftAreaSqm,
    wetDemandSqm: capacity.wetDemandSqm,
    shaftCapacityRatio: capacity.shaftCapacityRatio
  };
}

export function computeWetCorePathMetrics(version: PlanVersion, levelId?: string): WetCorePathResult {
  const scoped = scopeVersion(version, levelId);
  const shaftRooms = scoped.rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const wetRooms = scoped.rooms.filter((room) => room.needsPlumbing);
  const targetIds = shaftRooms.map((room) => room.id);
  const perRoom: WetCorePathResult["perRoom"] = [];

  wetRooms.forEach((room) => {
    if (targetIds.length === 0) {
      perRoom.push({
        roomId: room.id,
        roomName: room.name,
        distance: 14,
        method: "centroid-fallback"
      });
      return;
    }

    const result = shortestPathDistance(scoped, room.id, targetIds);
    perRoom.push({
      roomId: room.id,
      roomName: room.name,
      distance: result.distance,
      method: result.method
    });
  });

  const averageDistance =
    perRoom.length > 0 ? perRoom.reduce((total, item) => total + item.distance, 0) / perRoom.length : 14;

  return {
    averageDistance,
    perRoom,
    stackedShaftCount: countStackedShafts(version, shaftRooms),
    vertical: computeWetCoreVerticalMetrics(version, levelId)
  };
}
