import { normalizePlanVersion } from "@/lib/architecture-model";
import type { PlanVersion, Point } from "@/lib/project-types";

export function distancePlanUnits(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function calibrationScaleFactor(measuredDistance: number, realWorldMeters: number): number {
  if (measuredDistance <= 0) {
    throw new Error("Measured distance must be greater than zero.");
  }

  if (realWorldMeters <= 0) {
    throw new Error("Real-world distance must be greater than zero.");
  }

  return realWorldMeters / measuredDistance;
}

function scalePoint(point: Point, scale: number, anchor: Point): Point {
  return [anchor[0] + (point[0] - anchor[0]) * scale, anchor[1] + (point[1] - anchor[1]) * scale];
}

export function scalePlanVersion(version: PlanVersion, scale: number, anchor: Point = [0, 0]): PlanVersion {
  const transform = (point: Point) => scalePoint(point, scale, anchor);

  const scaled: PlanVersion = {
    ...version,
    outline: version.outline.map(transform),
    rooms: version.rooms.map((room) => ({
      ...room,
      polygon: room.polygon.map(transform),
      areaSqm: Number((room.areaSqm * scale * scale).toFixed(1))
    })),
    levels: version.levels.map((level) => ({
      ...level,
      rooms: level.rooms.map((room) => ({
        ...room,
        polygon: room.polygon.map(transform),
        areaSqm: Number((room.areaSqm * scale * scale).toFixed(1))
      })),
      walls: level.walls.map((wall) => ({
        ...wall,
        start: transform(wall.start),
        end: transform(wall.end),
        thickness: wall.thickness * scale
      })),
      openings: level.openings.map((opening) => ({
        ...opening,
        center: transform(opening.center),
        width: opening.width * scale
      }))
    }))
  };

  return normalizePlanVersion(scaled);
}

export function applyScaleCalibration(
  version: PlanVersion,
  pointA: Point,
  pointB: Point,
  realWorldMeters: number
): PlanVersion {
  const measured = distancePlanUnits(pointA, pointB);
  const factor = calibrationScaleFactor(measured, realWorldMeters);
  return scalePlanVersion(version, factor, pointA);
}
