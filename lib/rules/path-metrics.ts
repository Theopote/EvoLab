import { buildPathGraph, findPathGraphRoute } from "@/lib/analysis/path-graph";
import { buildRoomGraph, findRoomPath } from "@/lib/analysis/graph";
import {
  computeSemanticEgressForRoom,
  egressMethodLabel,
  findNearestSemanticExitPath,
  summarizeEgressMethod,
  type EgressPathMethod,
  type SemanticEgressRoute
} from "@/lib/analysis/egress-semantics";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

export type { EgressPathMethod, SemanticEgressRoute } from "@/lib/analysis/egress-semantics";
export { egressMethodLabel } from "@/lib/analysis/egress-semantics";

export interface EgressPathResult {
  maxDistance: number;
  worstRoomId?: string;
  worstRoomName?: string;
  method: EgressPathMethod;
  semanticRouteCount: number;
  incompleteRouteCount: number;
  fallbackRouteCount: number;
  perRoom: Array<{
    roomId: string;
    roomName: string;
    distance: number;
    method: EgressPathMethod;
    semanticValid: boolean;
    missingLinks: string[];
    exitName?: string;
  }>;
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
  const occupiableRooms = scoped.rooms.filter((room) => !["stair", "elevator", "shaft"].includes(room.type));
  const routes: SemanticEgressRoute[] = [];
  const perRoom: EgressPathResult["perRoom"] = [];
  let maxDistance = 0;
  let worstRoomId: string | undefined;
  let worstRoomName: string | undefined;

  occupiableRooms.forEach((room) => {
    const route = computeSemanticEgressForRoom(scoped, room.id);
    if (!route) {
      return;
    }

    routes.push(route);
    perRoom.push({
      roomId: room.id,
      roomName: room.name,
      distance: route.distance,
      method: route.method,
      semanticValid: route.semanticValid,
      missingLinks: route.missingLinks,
      exitName: route.exitName
    });

    if (route.distance > maxDistance) {
      maxDistance = route.distance;
      worstRoomId = room.id;
      worstRoomName = room.name;
    }
  });

  return {
    maxDistance,
    worstRoomId,
    worstRoomName,
    method: summarizeEgressMethod(routes),
    semanticRouteCount: routes.filter((route) => route.semanticValid).length,
    incompleteRouteCount: routes.filter((route) => route.method === "semantic-incomplete").length,
    fallbackRouteCount: routes.filter((route) => route.method === "centroid-fallback").length,
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
