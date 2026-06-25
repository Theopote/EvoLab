import type { Point } from "@/lib/project-types";

export const DEFAULT_CLUSTER_TOLERANCE = 0.05;

export function quantizeCoordinate(value: number, tolerance = DEFAULT_CLUSTER_TOLERANCE) {
  return Math.round(value / tolerance) * tolerance;
}

export function quantizePoint(point: Point, tolerance = DEFAULT_CLUSTER_TOLERANCE): string {
  const x = quantizeCoordinate(point[0], tolerance);
  const y = quantizeCoordinate(point[1], tolerance);
  return `${x},${y}`;
}

export function quantizePointCoords(point: Point, tolerance = DEFAULT_CLUSTER_TOLERANCE): Point {
  return [quantizeCoordinate(point[0], tolerance), quantizeCoordinate(point[1], tolerance)];
}

export function pointsNear(a: Point, b: Point, tolerance = DEFAULT_CLUSTER_TOLERANCE) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

export function clusterPoint(point: Point, clusters: Map<string, Point>, tolerance = DEFAULT_CLUSTER_TOLERANCE): Point {
  const key = quantizePoint(point, tolerance);

  if (!clusters.has(key)) {
    clusters.set(key, quantizePointCoords(point, tolerance));
  }

  return clusters.get(key)!;
}
