import { computeWetStackPathMetrics } from "@/lib/analysis/shaft-stack";
import {
  computeSemanticEgressForRoom,
  egressMethodLabel,
  summarizeEgressMethod,
  type EgressPathMethod,
  type SemanticEgressRoute
} from "@/lib/analysis/egress-semantics";
import { scopeVersionForLevel } from "@/lib/plan-scope";
import type { PlanVersion } from "@/lib/project-types";

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
  perRoom: Array<{
    roomId: string;
    roomName: string;
    distance: number;
    method: "path" | "centroid-fallback";
    stackId?: string;
    verticalAligned?: boolean;
    missingLinks?: string[];
  }>;
  stackedShaftCount: number;
  vertical: WetCoreVerticalMetrics;
}

function scopeVersion(version: PlanVersion, levelId?: string): PlanVersion {
  return scopeVersionForLevel(version, levelId);
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

function mapStackMethod(method: string): "path" | "centroid-fallback" {
  return method === "stack-path" ? "path" : "centroid-fallback";
}

export function computeWetCoreVerticalMetrics(version: PlanVersion, levelId?: string): WetCoreVerticalMetrics {
  const metrics = computeWetStackPathMetrics(version, levelId);

  return {
    stackGroups: metrics.stacks.length,
    stackCoverage: metrics.stackCoverage,
    stackedShaftCount: metrics.stackedShaftCount,
    shaftAreaSqm: metrics.shaftAreaSqm,
    wetDemandSqm: metrics.wetDemandSqm,
    shaftCapacityRatio: metrics.shaftCapacityRatio
  };
}

export function computeWetCorePathMetrics(version: PlanVersion, levelId?: string): WetCorePathResult {
  const metrics = computeWetStackPathMetrics(version, levelId);

  return {
    averageDistance: metrics.averageDistance,
    perRoom: metrics.perRoom.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      distance: room.horizontalDistance,
      method: mapStackMethod(room.method),
      stackId: room.stackId,
      verticalAligned: room.verticalAligned,
      missingLinks: room.missingLinks
    })),
    stackedShaftCount: metrics.stackedShaftCount,
    vertical: {
      stackGroups: metrics.stacks.length,
      stackCoverage: metrics.stackCoverage,
      stackedShaftCount: metrics.stackedShaftCount,
      shaftAreaSqm: metrics.shaftAreaSqm,
      wetDemandSqm: metrics.wetDemandSqm,
      shaftCapacityRatio: metrics.shaftCapacityRatio
    }
  };
}
