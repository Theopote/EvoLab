import ClipperLib from "clipper-lib";
import type { Point } from "@/lib/project-types";

const CLIPPER_SCALE = 1000;

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
