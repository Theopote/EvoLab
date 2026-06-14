import { diff, intersection, type Geometry, type Polygon, type Ring } from "martinez-polygon-clipping";
import type { Point } from "@/lib/project-types";

const AREA_EPSILON = 0.001;

function closeRing(points: Point[]): Ring {
  if (points.length === 0) {
    return [];
  }

  const first = points[0];
  const last = points[points.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1] ? points : [...points, first];
  return closed.map(([x, y]) => [x, y]);
}

function toPolygon(points: Point[]): Polygon {
  return [closeRing(points)];
}

function ringArea(ring: Ring) {
  const area = ring.reduce((total, [x, y], index) => {
    const [nextX, nextY] = ring[(index + 1) % ring.length];
    return total + x * nextY - nextX * y;
  }, 0);

  return Math.abs(area) / 2;
}

function isRing(value: unknown): value is Ring {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    Array.isArray(value[0]) &&
    typeof value[0][0] === "number" &&
    typeof value[0][1] === "number"
  );
}

function isPolygon(value: unknown): value is Polygon {
  return Array.isArray(value) && value.length > 0 && isRing(value[0]);
}

export function polygonArea(points: Point[]) {
  return ringArea(closeRing(points));
}

export function geometryArea(geometry: Geometry | null): number {
  if (!geometry) {
    return 0;
  }

  if (isPolygon(geometry)) {
    const [outer, ...holes] = geometry;
    return Math.max(0, ringArea(outer) - holes.reduce((total, hole) => total + ringArea(hole), 0));
  }

  return geometry.reduce<number>((total, polygon) => total + geometryArea(polygon), 0);
}

export function intersectionArea(a: Point[], b: Point[]) {
  try {
    return geometryArea(intersection(toPolygon(a), toPolygon(b)));
  } catch {
    return 0;
  }
}

export function outsideArea(subject: Point[], container: Point[]) {
  try {
    return geometryArea(diff(toPolygon(subject), toPolygon(container)));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function isPolygonInside(subject: Point[], container: Point[], tolerance = AREA_EPSILON) {
  return outsideArea(subject, container) <= tolerance;
}
