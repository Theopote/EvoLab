import type { Point } from "@/lib/project-types";
import { pointsNear } from "@/lib/geometry/snapping/endpoints";

export type GridSnapStep = 0.1 | 0.3;

export interface SnapPointOptions {
  gridStep?: GridSnapStep;
  gridEnabled?: boolean;
  endpointTargets?: Point[];
  endpointTolerance?: number;
}

const DEFAULT_GRID_STEP: GridSnapStep = 0.1;
const DEFAULT_ENDPOINT_TOLERANCE = 0.15;

export function snapGridCoordinate(value: number, step: GridSnapStep = DEFAULT_GRID_STEP) {
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
