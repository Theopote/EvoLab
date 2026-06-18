import type { CodeContext } from "@/lib/building-domain";
import type { OpeningElement, PlanVersion, Point, Room } from "@/lib/project-types";
import {
  intersectionArea,
  isPolygonInside,
  polygonArea as booleanPolygonArea
} from "@/lib/polygon-ops";
import { createSetbackBoundary } from "@/lib/polygon-offset";
import { computeWetCorePathMetrics } from "@/lib/rules/path-metrics";
import { checkRoomDaylightCompliance } from "@/lib/rules/metrics/daylight-compliance";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import type { RulePack } from "@/lib/rules/types";
import { extractWallsFromRooms } from "@/lib/wall-extractor";

export type PlanValidationSeverity = "warning" | "error";

export interface PlanValidationIssue {
  id: string;
  severity: PlanValidationSeverity;
  message: string;
  roomIds?: string[];
}

export interface PlanValidationResult {
  valid: boolean;
  issues: PlanValidationIssue[];
}

export interface PlanValidationOptions {
  setbackDistance?: number;
  codeContext?: CodeContext;
  projectType?: string;
  rulePack?: RulePack;
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function polygonArea(points: Point[]) {
  return booleanPolygonArea(points);
}

export function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function polygonArea(points: Point[]) {
  return booleanPolygonArea(points);
}
  const corridors = rooms.filter((room) => room.type === "corridor");

  if (corridors.length <= 1) {
    return true;
  }

  const corridorIds = new Set(corridors.map((room) => room.id));
  const visited = new Set<string>();
  const queue = [corridors[0].id];

  while (queue.length) {
    const id = queue.shift();
    if (!id || visited.has(id)) {
      continue;
    }

    visited.add(id);
    const room = rooms.find((item) => item.id === id);
    room?.adjacents?.forEach((adjacentId) => {
      if (corridorIds.has(adjacentId) && !visited.has(adjacentId)) {
        queue.push(adjacentId);
      }
    });
  }

  return corridors.every((room) => visited.has(room.id));
}

export function validatePlanVersion(
  version: PlanVersion,
  options: PlanValidationOptions = {}
): PlanValidationResult {
  const issues: PlanValidationIssue[] = [];
  const setback = options.setbackDistance
    ? createSetbackBoundary(version.outline, options.setbackDistance)
    : undefined;

  if (version.outline.length < 3) {
    issues.push({ id: "outline-invalid", severity: "error", message: "Outline must contain at least three points." });
  }

  if (setback && !setback.valid) {
    issues.push({
      id: "setback-invalid",
      severity: "warning",
      message: `Setback distance ${options.setbackDistance}m leaves no valid buildable boundary.`
    });
  }

  version.rooms.forEach((room) => {
    if (room.polygon.length < 3) {
      issues.push({ id: "room-polygon-invalid", severity: "error", message: `${room.name} has invalid polygon geometry.`, roomIds: [room.id] });
      return;
    }

    if (!isPolygonInside(room.polygon, version.outline, 0.01)) {
      issues.push({ id: "room-outside-outline", severity: "error", message: `${room.name} is not fully inside the building outline.`, roomIds: [room.id] });
    }

    if (setback?.valid && !isPolygonInside(room.polygon, setback.buildable, 0.01)) {
      issues.push({
        id: "room-outside-setback",
        severity: "warning",
        message: `${room.name} is outside the ${setback.distance}m setback buildable boundary.`,
        roomIds: [room.id]
      });
    }

    const actualArea = polygonArea(room.polygon);
    const deviation = Math.abs(actualArea - room.areaSqm) / Math.max(1, room.areaSqm);
    if (deviation > 0.2) {
      issues.push({ id: "room-area-mismatch", severity: "warning", message: `${room.name} area differs from polygon area by more than 20%.`, roomIds: [room.id] });
    }
  });

  version.rooms.forEach((room, index) => {
    version.rooms.slice(index + 1).forEach((otherRoom) => {
      const overlap = intersectionArea(room.polygon, otherRoom.polygon);
      const tolerance = Math.min(polygonArea(room.polygon), polygonArea(otherRoom.polygon)) * 0.05;
      if (overlap > Math.max(0.5, tolerance)) {
        issues.push({
          id: "room-overlap",
          severity: "error",
          message: `${room.name} overlaps ${otherRoom.name}.`,
          roomIds: [room.id, otherRoom.id]
        });
      }
    });
  });

  if (!validateCorridorConnectivity(version.rooms)) {
    issues.push({ id: "corridor-disconnected", severity: "warning", message: "Corridor rooms should form one connected circulation graph." });
  }

  const coreRooms = version.rooms.filter((room) => room.type === "stair" || room.type === "elevator");
  if (coreRooms.length === 0) {
    issues.push({ id: "core-missing", severity: "error", message: "At least one stair or elevator core is required." });
  }

  const rulePack = options.rulePack ?? resolveRulePack({ codeContext: options.codeContext, projectType: options.projectType });
  const plumbingMaxDistance = rulePack.scoring.plumbingMaxDistanceM;
  const daylightMaxDepth = rulePack.scoring.daylightMaxDepthM;

  version.rooms
    .filter((room) => room.needsDaylight)
    .forEach((room) => {
      const daylight = checkRoomDaylightCompliance(version, room, daylightMaxDepth);
      if (!daylight.compliant) {
        issues.push({
          id: "daylight-room-invalid",
          severity: "warning",
          message: `${room.name} needs daylight and should touch an external wall with a window within ${daylightMaxDepth}m depth.`,
          roomIds: [room.id]
        });
      }
    });

  const wetCoreMetrics = computeWetCorePathMetrics(version);
  const farWetRooms = wetCoreMetrics.perRoom.filter((item) => item.distance > plumbingMaxDistance);

  farWetRooms.forEach((item) => {
    issues.push({
      id: "plumbing-too-far",
      severity: "warning",
      message: `${item.roomName} needs plumbing and is about ${Math.round(item.distance)}m from the nearest shaft (${plumbingMaxDistance}m limit).`,
      roomIds: [item.roomId]
    });
  });

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}
