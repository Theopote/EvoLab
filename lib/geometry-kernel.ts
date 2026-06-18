import ClipperLib from "clipper-lib";
import { diff, intersection, union, type Geometry, type Polygon } from "martinez-polygon-clipping";
import type { Point } from "@/lib/project-types";
import { geometryArea, polygonArea } from "@/lib/polygon-ops";
import { insetPolygon, offsetPolygon } from "@/lib/polygon-offset";

export type { Geometry, Polygon };

const CLIPPER_SCALE = 1000;

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

function fromPolygon(geometry: Geometry | null): Point[][] {
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

export function intersectPolygons(a: Point[], b: Point[]) {
  try {
    return fromPolygon(intersection(toPolygon(a), toPolygon(b)));
  } catch {
    return [];
  }
}

export function subtractPolygons(subject: Point[], clip: Point[]) {
  try {
    return fromPolygon(diff(toPolygon(subject), toPolygon(clip)));
  } catch {
    return [];
  }
}

export function unitePolygons(a: Point[], b: Point[]) {
  try {
    return fromPolygon(union(toPolygon(a), toPolygon(b)));
  } catch {
    return [];
  }
}

export function polygonAreaSqm(points: Point[]) {
  return polygonArea(points);
}

export function geometryAreaSqm(geometry: Geometry | null) {
  return geometryArea(geometry);
}

export function insetBoundary(points: Point[], distance: number) {
  return insetPolygon(points, distance);
}

export function outsetBoundary(points: Point[], distance: number) {
  return offsetPolygon(points, distance);
}

export function simplifyPolygon(points: Point[], tolerance = 0.05) {
  if (points.length < 3) {
    return points;
  }

  const path = points.map(([x, y]) => ({
    X: Math.round(x * CLIPPER_SCALE),
    Y: Math.round(y * CLIPPER_SCALE)
  }));
  const cleaned = ClipperLib.Clipper.CleanPolygon(path, Math.max(1, tolerance * CLIPPER_SCALE));

  return cleaned.map((point) => [point.X / CLIPPER_SCALE, point.Y / CLIPPER_SCALE] as Point);
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
