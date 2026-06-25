import type { CodeContext } from "@/lib/building-domain";
import type { FloorValidationSummary, PlanVersion, Point, Room } from "@/lib/project-types";
import {
  intersectionArea,
  isPolygonInside,
  polygonArea
} from "@/lib/geometry/kernel";
import { distance, polygonCentroid } from "@/lib/geometry/kernel/point";
import { createSetbackBoundary } from "@/lib/polygon-offset";
import { collectLevelValidationUnits, scopeVersionForLevel } from "@/lib/plan-scope";
import { computeWetCorePathMetrics } from "@/lib/rules/path-metrics";
import { checkRoomDaylightCompliance } from "@/lib/rules/metrics/daylight-compliance";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import type { RulePack } from "@/lib/rules/types";

export type PlanValidationSeverity = "warning" | "error";

export interface PlanValidationIssue {
  id: string;
  severity: PlanValidationSeverity;
  message: string;
  roomIds?: string[];
  levelId?: string;
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

export { distance, polygonArea };

export function centroid(room: Room): Point {
  return polygonCentroid(room.polygon);
}

function validateCorridorConnectivity(rooms: Room[]) {
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

function levelPrefix(levelName: string, multiLevel: boolean) {
  return multiLevel ? `[${levelName}] ` : "";
}

function validateLevelGeometry(
  unit: ReturnType<typeof collectLevelValidationUnits>[number],
  options: {
    multiLevel: boolean;
    setback?: ReturnType<typeof createSetbackBoundary>;
    setbackDistance?: number;
  }
): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];
  const prefix = levelPrefix(unit.levelName, options.multiLevel);

  unit.rooms.forEach((room) => {
    if (room.polygon.length < 3) {
      issues.push({
        id: "room-polygon-invalid",
        severity: "error",
        message: `${prefix}${room.name} has invalid polygon geometry.`,
        roomIds: [room.id],
        levelId: unit.levelId
      });
      return;
    }

    if (!isPolygonInside(room.polygon, unit.outline, 0.01)) {
      issues.push({
        id: "room-outside-outline",
        severity: "error",
        message: `${prefix}${room.name} is not fully inside the level outline.`,
        roomIds: [room.id],
        levelId: unit.levelId
      });
    }

    if (options.setback?.valid && !isPolygonInside(room.polygon, options.setback.buildable, 0.01)) {
      issues.push({
        id: "room-outside-setback",
        severity: "warning",
        message: `${prefix}${room.name} is outside the ${options.setback.distance}m setback buildable boundary.`,
        roomIds: [room.id],
        levelId: unit.levelId
      });
    }

    const actualArea = polygonArea(room.polygon);
    const deviation = Math.abs(actualArea - room.areaSqm) / Math.max(1, room.areaSqm);
    if (deviation > 0.2) {
      issues.push({
        id: "room-area-mismatch",
        severity: "warning",
        message: `${prefix}${room.name} area differs from polygon area by more than 20%.`,
        roomIds: [room.id],
        levelId: unit.levelId
      });
    }
  });

  unit.rooms.forEach((room, index) => {
    unit.rooms.slice(index + 1).forEach((otherRoom) => {
      const overlap = intersectionArea(room.polygon, otherRoom.polygon);
      const tolerance = Math.min(polygonArea(room.polygon), polygonArea(otherRoom.polygon)) * 0.05;
      if (overlap > Math.max(0.5, tolerance)) {
        issues.push({
          id: "room-overlap",
          severity: "error",
          message: `${prefix}${room.name} overlaps ${otherRoom.name}.`,
          roomIds: [room.id, otherRoom.id],
          levelId: unit.levelId
        });
      }
    });
  });

  if (!validateCorridorConnectivity(unit.rooms)) {
    issues.push({
      id: "corridor-disconnected",
      severity: "warning",
      message: `${prefix}Corridor rooms should form one connected circulation graph.`,
      levelId: unit.levelId
    });
  }

  const coreRooms = unit.rooms.filter((room) => room.type === "stair" || room.type === "elevator");
  if (coreRooms.length === 0) {
    issues.push({
      id: "core-missing",
      severity: "error",
      message: `${prefix}At least one stair or elevator core is required.`,
      levelId: unit.levelId
    });
  }

  return issues;
}

export function validatePlanVersion(
  version: PlanVersion,
  options: PlanValidationOptions = {}
): PlanValidationResult {
  const issues: PlanValidationIssue[] = [];
  const setback = options.setbackDistance
    ? createSetbackBoundary(version.outline, options.setbackDistance)
    : undefined;
  const multiLevel = version.levels.length > 1;

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

  const units = collectLevelValidationUnits(version);

  units.forEach((unit) => {
    issues.push(
      ...validateLevelGeometry(unit, {
        multiLevel,
        setback,
        setbackDistance: options.setbackDistance
      })
    );
  });

  const rulePack = options.rulePack ?? resolveRulePack({ codeContext: options.codeContext, projectType: options.projectType });
  const plumbingMaxDistance = rulePack.scoring.plumbingMaxDistanceM;
  const daylightMaxDepth = rulePack.scoring.daylightMaxDepthM;

  units.forEach((unit) => {
    const prefix = levelPrefix(unit.levelName, multiLevel);
    const scopedVersion = scopeVersionForLevel(version, unit.levelId);

    unit.rooms
      .filter((room) => room.needsDaylight)
      .forEach((room) => {
        const daylight = checkRoomDaylightCompliance(scopedVersion, room, daylightMaxDepth);
        if (!daylight.compliant) {
          issues.push({
            id: "daylight-room-invalid",
            severity: "warning",
            message: `${prefix}${room.name} needs daylight and should touch an external wall with a window within ${daylightMaxDepth}m depth.`,
            roomIds: [room.id],
            levelId: unit.levelId
          });
        }
      });

    const wetCoreMetrics = computeWetCorePathMetrics(scopedVersion, unit.levelId);
    const farWetRooms = wetCoreMetrics.perRoom.filter((item) => item.distance > plumbingMaxDistance);

    farWetRooms.forEach((item) => {
      issues.push({
        id: "plumbing-too-far",
        severity: "warning",
        message: `${prefix}${item.roomName} needs plumbing and is about ${Math.round(item.distance)}m from the nearest shaft (${plumbingMaxDistance}m limit).`,
        roomIds: [item.roomId],
        levelId: unit.levelId
      });
    });
  });

  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues
  };
}

function summarizeIssues(issues: PlanValidationIssue[]): Pick<
  FloorValidationSummary,
  "issueCount" | "errorCount" | "warningCount" | "valid" | "issueIds" | "messages"
> {
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;

  return {
    issueCount: issues.length,
    errorCount,
    warningCount,
    valid: errorCount === 0,
    issueIds: issues.map((issue) => issue.id),
    messages: issues.map((issue) => issue.message)
  };
}

/** Roll up validation issues per physical floor (plus building-wide bucket when present). */
export function buildFloorValidationSummary(
  version: PlanVersion,
  issues: PlanValidationIssue[]
): FloorValidationSummary[] {
  const buildingWideIssues = issues.filter((issue) => !issue.levelId);
  const summaries = collectLevelValidationUnits(version).map((unit) => {
    const level = version.levels.find((item) => item.id === unit.levelId);
    const levelIssues = issues.filter((issue) => issue.levelId === unit.levelId);

    return {
      levelId: unit.levelId,
      levelName: unit.levelName,
      floorProgram: level?.floorProgram,
      ...summarizeIssues(levelIssues)
    };
  });

  if (buildingWideIssues.length > 0) {
    summaries.unshift({
      levelId: "building",
      levelName: "Building-wide",
      floorProgram: undefined,
      ...summarizeIssues(buildingWideIssues)
    });
  }

  return summaries;
}
