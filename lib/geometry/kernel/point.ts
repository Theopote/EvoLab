import type { Point } from "@/lib/project-types";

export function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function polygonCentroid(polygon: Point[]): Point {
  if (polygon.length === 0) {
    return [0, 0];
  }

  const total = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length];
}

export function pointInPolygon(point: Point, polygon: Point[]) {
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
