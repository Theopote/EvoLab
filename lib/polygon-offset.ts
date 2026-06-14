import ClipperLib from "clipper-lib";
import type { Point } from "@/lib/project-types";
import { polygonArea } from "@/lib/polygon-ops";

export type OffsetJoinType = "miter" | "square" | "round";

export interface PolygonOffsetOptions {
  joinType?: OffsetJoinType;
  miterLimit?: number;
  arcTolerance?: number;
  scale?: number;
}

export interface SetbackBoundary {
  source: Point[];
  distance: number;
  buildable: Point[];
  valid: boolean;
  areaSqm: number;
}

const defaultScale = 1000;

function toClipperPath(points: Point[], scale: number): ClipperLib.Path {
  return points.map(([x, y]) => ({
    X: Math.round(x * scale),
    Y: Math.round(y * scale)
  }));
}

function fromClipperPath(path: ClipperLib.Path, scale: number): Point[] {
  return path.map((point) => [point.X / scale, point.Y / scale]);
}

function joinTypeToClipper(joinType: OffsetJoinType) {
  if (joinType === "round") {
    return ClipperLib.JoinType.jtRound;
  }

  if (joinType === "square") {
    return ClipperLib.JoinType.jtSquare;
  }

  return ClipperLib.JoinType.jtMiter;
}

function cleanPath(path: ClipperLib.Path, scale: number) {
  return ClipperLib.Clipper.CleanPolygon(path, Math.max(1, scale * 0.001));
}

function largestPath(paths: ClipperLib.Paths) {
  return [...paths].sort((a, b) => Math.abs(ClipperLib.Clipper.Area(b)) - Math.abs(ClipperLib.Clipper.Area(a)))[0];
}

export function offsetPolygon(
  polygon: Point[],
  distance: number,
  options: PolygonOffsetOptions = {}
): Point[] {
  if (polygon.length < 3 || distance === 0) {
    return polygon;
  }

  const scale = options.scale ?? defaultScale;
  const sourcePath = cleanPath(toClipperPath(polygon, scale), scale);

  if (sourcePath.length < 3) {
    return [];
  }

  const offsetter = new ClipperLib.ClipperOffset(options.miterLimit ?? 2, (options.arcTolerance ?? 0.1) * scale);
  const solution: ClipperLib.Paths = [];

  offsetter.AddPath(sourcePath, joinTypeToClipper(options.joinType ?? "miter"), ClipperLib.EndType.etClosedPolygon);
  offsetter.Execute(solution, distance * scale);

  const path = largestPath(solution);

  return path ? fromClipperPath(cleanPath(path, scale), scale) : [];
}

export function insetPolygon(
  polygon: Point[],
  distance: number,
  options: PolygonOffsetOptions = {}
) {
  return offsetPolygon(polygon, -Math.abs(distance), options);
}

export function outsetPolygon(
  polygon: Point[],
  distance: number,
  options: PolygonOffsetOptions = {}
) {
  return offsetPolygon(polygon, Math.abs(distance), options);
}

export function createSetbackBoundary(
  outline: Point[],
  distance: number,
  options: PolygonOffsetOptions = {}
): SetbackBoundary {
  const buildable = insetPolygon(outline, distance, options);
  const areaSqm = buildable.length >= 3 ? polygonArea(buildable) : 0;

  return {
    source: outline,
    distance,
    buildable,
    valid: buildable.length >= 3 && areaSqm > 0,
    areaSqm
  };
}
