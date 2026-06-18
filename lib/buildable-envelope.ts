import { insetBoundary, polygonAreaSqm } from "@/lib/geometry-kernel";
import type { Point } from "@/lib/project-types";
import type { BuildableEnvelope, ZoningConstraints } from "@/lib/site-types";

function bounds(points: Point[]) {
  return points.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

export function computeBuildableEnvelope(
  siteOutline: Point[],
  zoning: ZoningConstraints
): BuildableEnvelope {
  if (siteOutline.length < 3) {
    return {
      footprint: [],
      maxHeightMeters: zoning.maxHeightMeters,
      maxFloorAreaSqm: 0,
      volumeCubicMeters: 0,
      valid: false
    };
  }

  const footprint = insetBoundary(siteOutline, zoning.setbackMeters);
  const siteArea = polygonAreaSqm(siteOutline);
  const footprintArea = footprint.length >= 3 ? polygonAreaSqm(footprint) : 0;
  const coverageCapArea = siteArea * zoning.maxCoverageRatio;
  const farCapArea = siteArea * zoning.maxFar;
  const maxFloorAreaSqm = Math.min(
    footprintArea > 0 ? footprintArea : coverageCapArea,
    farCapArea > 0 ? farCapArea : Number.POSITIVE_INFINITY
  );

  return {
    footprint,
    maxHeightMeters: zoning.maxHeightMeters,
    maxFloorAreaSqm: Math.round(maxFloorAreaSqm),
    volumeCubicMeters: Math.round(maxFloorAreaSqm * zoning.maxHeightMeters),
    valid: footprint.length >= 3 && footprintArea > 0
  };
}

export function envelopeContainsPolygon(envelope: BuildableEnvelope, polygon: Point[]) {
  if (!envelope.valid || envelope.footprint.length < 3 || polygon.length < 3) {
    return false;
  }

  return polygon.every((point) => pointInsidePolygon(point, envelope.footprint));
}

function pointInsidePolygon(point: Point, polygon: Point[]) {
  const [x, y] = point;
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [xi, yi] = polygon[index];
    const [xp, yp] = polygon[previous];
    const intersects = yi > y !== yp > y && x < ((xp - xi) * (y - yi)) / (yp - yi + Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function estimateBuildingHeight(versionRooms: Array<{ ceilingHeight: number; type: string }>, floors: number) {
  const tallestRoom = versionRooms.reduce((max, room) => Math.max(max, room.ceilingHeight), 3.2);
  return tallestRoom * Math.max(1, floors);
}

export function validateAgainstEnvelope(
  envelope: BuildableEnvelope,
  outline: Point[],
  buildingHeightMeters: number
) {
  const issues: string[] = [];

  if (!envelope.valid) {
    issues.push("Buildable envelope is invalid. Adjust setback or site outline.");
    return issues;
  }

  if (!envelopeContainsPolygon(envelope, outline)) {
    issues.push("Site outline exceeds the zoning setback buildable footprint.");
  }

  if (buildingHeightMeters > envelope.maxHeightMeters + 0.01) {
    issues.push(
      `Building height ${buildingHeightMeters.toFixed(1)}m exceeds zoning limit ${envelope.maxHeightMeters}m.`
    );
  }

  return issues;
}
