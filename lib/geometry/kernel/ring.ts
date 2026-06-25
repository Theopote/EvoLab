import type { Geometry, Polygon, Ring } from "martinez-polygon-clipping";
import type { Point } from "@/lib/project-types";

export function closeRing(points: Point[]): Ring {
  if (points.length === 0) {
    return [];
  }

  const first = points[0];
  const last = points[points.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1] ? points : [...points, first];
  return closed.map(([x, y]) => [x, y]);
}

export function toPolygon(points: Point[]): Polygon {
  return [closeRing(points)];
}

export function fromPolygon(geometry: Geometry | null): Point[][] {
  if (!geometry) {
    return [];
  }

  if (Array.isArray(geometry[0]?.[0])) {
    return (geometry as Polygon[]).map((polygon) => {
      const [outer] = polygon;
      return outer.slice(0, -1).map(([x, y]) => [x, y] as Point);
    });
  }

  const [outer] = geometry as Polygon;
  return [outer.slice(0, -1).map(([x, y]) => [x, y] as Point)];
}
