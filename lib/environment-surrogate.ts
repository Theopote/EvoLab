import type { Point } from "@/lib/project-types";
import type { EnvironmentGridCell, EnvironmentSurrogate, SiteBuildingFootprint } from "@/lib/site-types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildingHeightAt(buildings: SiteBuildingFootprint[], point: Point) {
  return buildings.reduce((maxHeight, building) => {
    if (!pointInsidePolygon(point, building.polygon)) {
      return maxHeight;
    }

    return Math.max(maxHeight, building.heightMeters);
  }, 0);
}

function pointInsidePolygon(point: Point, polygon: Point[]) {
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

function sunProxyForCell(
  x: number,
  y: number,
  width: number,
  height: number,
  buildings: SiteBuildingFootprint[]
) {
  const southExposure = 1 - y / Math.max(1, height);
  const eastWestBalance = 1 - Math.abs(x / Math.max(1, width) - 0.5) * 0.35;
  const obstruction =
    buildings.reduce((max, building) => {
      const center = building.polygon.reduce(
        (acc, [px, py]) => [acc[0] + px, acc[1] + py] as Point,
        [0, 0]
      );
      center[0] /= building.polygon.length;
      center[1] /= building.polygon.length;

      if (center[1] >= y) {
        return max;
      }

      const dx = x - center[0];
      const dy = y - center[1];
      const distance = Math.hypot(dx, dy);
      const shadowAngle = Math.atan2(building.heightMeters, Math.max(1, distance));
      return Math.max(max, shadowAngle);
    }, 0) / (Math.PI / 2);

  return clamp(2 + southExposure * 5 + eastWestBalance * 2 - obstruction * 4.5, 0.5, 8.5);
}

function windShelterForCell(
  x: number,
  y: number,
  width: number,
  height: number,
  buildings: SiteBuildingFootprint[],
  windFrom: "north" | "south" | "east" | "west"
) {
  const windVector =
    windFrom === "north"
      ? [0, 1]
      : windFrom === "south"
        ? [0, -1]
        : windFrom === "east"
          ? [-1, 0]
          : [1, 0];

  const upstreamMass = buildings.reduce((sum, building) => {
    const center = building.polygon.reduce(
      (acc, [px, py]) => [acc[0] + px, acc[1] + py] as Point,
      [0, 0]
    );
    center[0] /= building.polygon.length;
    center[1] /= building.polygon.length;

    const vx = center[0] - x;
    const vy = center[1] - y;
    const alignment = vx * windVector[0] + vy * windVector[1];

    if (alignment <= 0) {
      return sum;
    }

    const distance = Math.hypot(vx, vy);
    return sum + (building.heightMeters * building.polygon.length) / Math.max(12, distance);
  }, 0);

  const edgeOpenness =
    windFrom === "north"
      ? 1 - y / Math.max(1, height)
      : windFrom === "south"
        ? y / Math.max(1, height)
        : windFrom === "east"
          ? 1 - x / Math.max(1, width)
          : x / Math.max(1, width);

  return clamp(edgeOpenness * 0.55 + upstreamMass * 0.04, 0, 1);
}

export function computeEnvironmentSurrogate(input: {
  outline: Point[];
  buildings: SiteBuildingFootprint[];
  gridSize?: number;
  dominantWindFrom?: EnvironmentSurrogate["dominantWindFrom"];
}): EnvironmentSurrogate {
  const gridSize = input.gridSize ?? 16;
  const outline = input.outline;
  const minX = Math.min(...outline.map(([x]) => x));
  const minY = Math.min(...outline.map(([, y]) => y));
  const maxX = Math.max(...outline.map(([x]) => x));
  const maxY = Math.max(...outline.map(([, y]) => y));
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const dominantWindFrom = input.dominantWindFrom ?? "north";
  const cells: EnvironmentGridCell[] = [];

  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const x = minX + ((col + 0.5) / gridSize) * width;
      const y = minY + ((row + 0.5) / gridSize) * height;

      cells.push({
        x,
        y,
        sunHours: sunProxyForCell(x, y, width, height, input.buildings),
        windShelter: windShelterForCell(x, y, width, height, input.buildings, dominantWindFrom)
      });
    }
  }

  return {
    gridSize,
    cells,
    dominantWindFrom,
    computedAt: new Date().toISOString()
  };
}
