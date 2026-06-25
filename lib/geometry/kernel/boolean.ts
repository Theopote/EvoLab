import { diff, intersection, union } from "martinez-polygon-clipping";
import type { Point } from "@/lib/project-types";
import { AREA_EPSILON, geometryArea } from "@/lib/geometry/kernel/measure";
import { fromPolygon, toPolygon } from "@/lib/geometry/kernel/ring";

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
