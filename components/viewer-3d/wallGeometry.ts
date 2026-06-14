import type { Point } from "@/lib/project-types";

export function getPolygonCenter(polygon: Point[]): [number, number] {
  const total = polygon.reduce(
    (acc, [x, y]) => ({
      x: acc.x + x,
      y: acc.y + y
    }),
    { x: 0, y: 0 }
  );

  return [total.x / polygon.length, total.y / polygon.length];
}

export function getPolygonBounds(polygon: Point[]) {
  return polygon.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}
