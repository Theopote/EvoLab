import type { Geometry, Polygon, Ring } from "martinez-polygon-clipping";
import type { Point } from "@/lib/project-types";
import { closeRing } from "@/lib/geometry/kernel/ring";

export const AREA_EPSILON = 0.001;

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

export function ringArea(ring: Ring) {
  const area = ring.reduce((total, [x, y], index) => {
    const [nextX, nextY] = ring[(index + 1) % ring.length];
    return total + x * nextY - nextX * y;
  }, 0);

  return Math.abs(area) / 2;
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

export function polygonAreaSqm(points: Point[]) {
  return polygonArea(points);
}

export function geometryAreaSqm(geometry: Geometry | null) {
  return geometryArea(geometry);
}
