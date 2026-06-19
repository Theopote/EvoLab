import { diff, intersection, union, type Geometry, type Polygon } from "martinez-polygon-clipping";
import type { Point, Room } from "@/lib/project-types";
import { geometryArea } from "@/lib/polygon-ops";

const GAP_AREA_THRESHOLD_SQM = 0.25;
const OVERLAP_AREA_THRESHOLD_SQM = 0.15;

function closeRing(points: Point[]): Point[] {
  if (points.length === 0) {
    return points;
  }

  const first = points[0];
  const last = points[points.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? points : [...points, first];
}

function toPolygon(points: Point[]): Polygon {
  return [closeRing(points).map(([x, y]) => [x, y])];
}

function unionRoomPolygons(rooms: Room[]): Geometry | null {
  let merged: Geometry | null = null;

  for (const room of rooms) {
    const polygon = toPolygon(room.polygon);

    try {
      merged = merged ? union(merged, polygon) : polygon;
    } catch {
      return null;
    }
  }

  return merged;
}

export interface GeometryGapOverlapIssue {
  kind: "gap" | "overlap";
  areaSqm: number;
  message: string;
}

export function detectGapsAndOverlaps(outline: Point[], rooms: Room[]): GeometryGapOverlapIssue[] {
  const issues: GeometryGapOverlapIssue[] = [];
  const outlineGeometry = toPolygon(outline);
  const roomUnion = unionRoomPolygons(rooms);

  if (!roomUnion) {
    return [
      {
        kind: "gap",
        areaSqm: 0,
        message: "Unable to union room polygons for geometry validation."
      }
    ];
  }

  try {
    const gapGeometry = diff(outlineGeometry, roomUnion as Polygon);
    const gapArea = geometryArea(gapGeometry);

    if (gapArea > GAP_AREA_THRESHOLD_SQM) {
      issues.push({
        kind: "gap",
        areaSqm: gapArea,
        message: `Uncovered area inside outline: ${gapArea.toFixed(2)} sqm.`
      });
    }
  } catch {
    issues.push({
      kind: "gap",
      areaSqm: 0,
      message: "Gap detection failed while comparing rooms to outline."
    });
  }

  const overlaps: Array<{ a: string; b: string; areaSqm: number }> = [];

  for (let left = 0; left < rooms.length; left += 1) {
    for (let right = left + 1; right < rooms.length; right += 1) {
      const leftRoom = rooms[left]!;
      const rightRoom = rooms[right]!;

      try {
        const overlapGeometry = intersection(toPolygon(leftRoom.polygon), toPolygon(rightRoom.polygon));
        const overlapArea = geometryArea(overlapGeometry);

        if (overlapArea > OVERLAP_AREA_THRESHOLD_SQM) {
          overlaps.push({
            a: leftRoom.id,
            b: rightRoom.id,
            areaSqm: overlapArea
          });
        }
      } catch {
        // skip pair
      }
    }
  }

  overlaps.forEach((overlap) => {
    issues.push({
      kind: "overlap",
      areaSqm: overlap.areaSqm,
      message: `Rooms ${overlap.a} and ${overlap.b} overlap by ${overlap.areaSqm.toFixed(2)} sqm.`
    });
  });

  return issues;
}

export function geometryValidationPassed(outline: Point[], rooms: Room[]): boolean {
  return detectGapsAndOverlaps(outline, rooms).length === 0;
}
