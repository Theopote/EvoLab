import type { Point } from "@/lib/project-types";

function roundPoint([x, y]: Point): Point {
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

export function normalizeOutlinePoints(outline: Point[]): Point[] {
  if (outline.length < 3) {
    return outline.map(roundPoint);
  }

  const bounds = outline.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  return outline.map(([x, y]) => roundPoint([x - bounds.minX, y - bounds.minY]));
}

export function outlinesEqual(left: Point[], right: Point[]) {
  const a = normalizeOutlinePoints(left);
  const b = normalizeOutlinePoints(right);

  if (a.length !== b.length || a.length < 3) {
    return false;
  }

  return a.every((point, index) => point[0] === b[index][0] && point[1] === b[index][1]);
}

export function isOutlineStale(storeOutline: Point[], versionOutline?: Point[]) {
  if (!versionOutline || versionOutline.length < 3 || storeOutline.length < 3) {
    return false;
  }

  return !outlinesEqual(storeOutline, versionOutline);
}
