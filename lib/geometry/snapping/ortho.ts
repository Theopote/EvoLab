import type { Point } from "@/lib/project-types";

export interface SnapDeltaOptions {
  orthoEnabled?: boolean;
  orthoOrigin?: Point;
  orthoThresholdDeg?: number;
}

function normalizeAngle(radians: number) {
  const tau = Math.PI * 2;
  const normalized = radians % tau;
  return normalized < 0 ? normalized + tau : normalized;
}

function angleDistance(a: number, b: number) {
  const delta = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(delta, Math.PI * 2 - delta);
}

export function constrainOrthoDelta(origin: Point, target: Point, thresholdDeg = 8): Point {
  const dx = target[0] - origin[0];
  const dy = target[1] - origin[1];
  const angle = Math.atan2(dy, dx);
  const threshold = (thresholdDeg * Math.PI) / 180;
  const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];

  const nearest = cardinals.reduce(
    (best, cardinal) => {
      const distance = angleDistance(angle, cardinal);
      return distance < best.distance ? { cardinal, distance } : best;
    },
    { cardinal: 0, distance: Infinity }
  );

  if (nearest.distance > threshold) {
    return [dx, dy];
  }

  if (nearest.cardinal === 0 || nearest.cardinal === Math.PI) {
    return [dx, 0];
  }

  return [0, dy];
}
