import type { Point } from "@/lib/project-types";

export interface WallSegment {
  id: string;
  start: Point;
  end: Point;
  length: number;
  angle: number;
  center: [number, number, number];
  height: number;
  thickness: number;
}

export function createWallSegments(
  polygon: Point[],
  height: number,
  thickness = 0.28,
  prefix = "wall"
): WallSegment[] {
  if (polygon.length < 2) {
    return [];
  }

  return polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);

    return {
      id: `${prefix}-${index}`,
      start,
      end,
      length,
      angle: Math.atan2(dy, dx),
      center: [(start[0] + end[0]) / 2, height / 2, (start[1] + end[1]) / 2],
      height,
      thickness
    };
  });
}

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
