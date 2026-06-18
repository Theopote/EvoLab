import { buildRoomGraph, findNearestExitPath, findRoomPath } from "@/lib/analysis/graph";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

export interface EgressPathResult {
  maxDistance: number;
  worstRoomId?: string;
  worstRoomName?: string;
  method: "path" | "centroid-fallback";
  perRoom: Array<{ roomId: string; roomName: string; distance: number; method: "path" | "centroid-fallback" }>;
}

export interface WetCorePathResult {
  averageDistance: number;
  perRoom: Array<{ roomId: string; roomName: string; distance: number; method: "path" | "centroid-fallback" }>;
  stackedShaftCount: number;
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

function shortestPathDistance(
  graph: ReturnType<typeof buildRoomGraph>,
  version: PlanVersion,
  startRoomId: string,
  targetRoomIds: string[]
): { distance: number; method: "path" | "centroid-fallback" } {
  let best = Infinity;
  let method: "path" | "centroid-fallback" = "centroid-fallback";

  targetRoomIds.forEach((targetId) => {
    const route = findRoomPath(graph, startRoomId, targetId);
    if (route && route.length >= 2) {
      const pathDistance = route.slice(1).reduce((total, point, index) => {
        const previous = route[index];
        return total + distance(point, previous);
      }, 0);

      if (pathDistance < best) {
        best = pathDistance;
        method = "path";
      }
      return;
    }

    const start = version.rooms.find((room) => room.id === startRoomId);
    const target = version.rooms.find((room) => room.id === targetId);
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
  const graph = buildRoomGraph(scoped);
  const occupiableRooms = scoped.rooms.filter((room) => !["stair", "elevator", "shaft"].includes(room.type));
  const perRoom: EgressPathResult["perRoom"] = [];
  let maxDistance = 0;
  let worstRoomId: string | undefined;
  let worstRoomName: string | undefined;
  let method: EgressPathResult["method"] = "path";

  occupiableRooms.forEach((room) => {
    const route = findNearestExitPath(graph, scoped, room.id);

    if (route) {
      perRoom.push({
        roomId: room.id,
        roomName: room.name,
        distance: route.distance,
        method: "path"
      });

      if (route.distance > maxDistance) {
        maxDistance = route.distance;
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
    method: perRoom.some((item) => item.method === "path") ? method : "centroid-fallback",
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

export function computeWetCorePathMetrics(version: PlanVersion, levelId?: string): WetCorePathResult {
  const scoped = scopeVersion(version, levelId);
  const graph = buildRoomGraph(scoped);
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

    const result = shortestPathDistance(graph, scoped, room.id, targetIds);
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
    stackedShaftCount: countStackedShafts(version, shaftRooms)
  };
}
