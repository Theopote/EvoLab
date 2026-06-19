import type { Point, Wall } from "@/lib/project-types";
import { pointsNear } from "@/lib/wall-graph";

export type GridSnapStep = 0.1 | 0.3;

export interface SnapPointOptions {
  gridStep?: GridSnapStep;
  gridEnabled?: boolean;
  endpointTargets?: Point[];
  endpointTolerance?: number;
}

export interface SnapDeltaOptions {
  orthoEnabled?: boolean;
  orthoOrigin?: Point;
  orthoThresholdDeg?: number;
}

const DEFAULT_GRID_STEP: GridSnapStep = 0.1;
const DEFAULT_ENDPOINT_TOLERANCE = 0.15;

export function snapGridCoordinate(value: number, step = DEFAULT_GRID_STEP) {
  return Math.round(value / step) * step;
}

export function snapPoint(point: Point, options: SnapPointOptions = {}): Point {
  const gridEnabled = options.gridEnabled ?? true;
  const gridStep = options.gridStep ?? DEFAULT_GRID_STEP;
  const endpointTolerance = options.endpointTolerance ?? DEFAULT_ENDPOINT_TOLERANCE;

  let [x, y] = point;

  if (options.endpointTargets?.length) {
    const snappedEndpoint = options.endpointTargets.find((target) => pointsNear(target, point, endpointTolerance));

    if (snappedEndpoint) {
      return [...snappedEndpoint] as Point;
    }
  }

  if (gridEnabled) {
    x = snapGridCoordinate(x, gridStep);
    y = snapGridCoordinate(y, gridStep);
  }

  return [x, y];
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

  const nearest = cardinals.reduce((best, cardinal) => {
    const distance = angleDistance(angle, cardinal);
    return distance < best.distance ? { cardinal, distance } : best;
  }, { cardinal: 0, distance: Infinity });

  if (nearest.distance > threshold) {
    return [dx, dy];
  }

  if (nearest.cardinal === 0 || nearest.cardinal === Math.PI) {
    return [dx, 0];
  }

  return [0, dy];
}

export function wallUnitNormal(wall: Wall): Point {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy);

  if (length < 0.001) {
    return [0, 1];
  }

  return [-dy / length, dx / length];
}

export function projectDeltaOntoNormal(delta: Point, normal: Point): Point {
  const dot = delta[0] * normal[0] + delta[1] * normal[1];
  return [normal[0] * dot, normal[1] * dot];
}
