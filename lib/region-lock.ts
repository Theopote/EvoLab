import type { Point, Room } from "@/lib/project-types";

export interface SelectionBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function pointInBBox(point: Point, bbox: SelectionBBox) {
  return point[0] >= bbox.minX && point[0] <= bbox.maxX && point[1] >= bbox.minY && point[1] <= bbox.maxY;
}

function roomIntersectsBBox(room: Room, bbox: SelectionBBox) {
  if (room.polygon.some((point) => pointInBBox(point, bbox))) {
    return true;
  }

  const centroid = room.polygon.reduce(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point,
    [0, 0] as Point
  );
  const center: Point = [centroid[0] / room.polygon.length, centroid[1] / room.polygon.length];

  return pointInBBox(center, bbox);
}

export function bboxFromPoints(points: Point[], padding = 0.5): SelectionBBox | undefined {
  if (points.length === 0) {
    return undefined;
  }

  const bbox = points.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  return {
    minX: bbox.minX - padding,
    minY: bbox.minY - padding,
    maxX: bbox.maxX + padding,
    maxY: bbox.maxY + padding
  };
}

export function bboxFromStrokes(strokes: Point[][], padding = 0.5): SelectionBBox | undefined {
  return bboxFromPoints(strokes.flat(), padding);
}

export function roomsInSelection(rooms: Room[], bbox: SelectionBBox): Set<string> {
  return new Set(rooms.filter((room) => roomIntersectsBBox(room, bbox)).map((room) => room.id));
}

export function enforceRegionLock(
  original: Room[],
  aiModified: Room[],
  allowedIds: Set<string>
): Room[] {
  const modifiedById = new Map(aiModified.map((room) => [room.id, room]));

  return original.map((orig) => {
    if (!allowedIds.has(orig.id)) {
      return orig;
    }

    return modifiedById.get(orig.id) ?? orig;
  });
}
