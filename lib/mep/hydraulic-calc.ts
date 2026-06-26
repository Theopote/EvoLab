import type { MepRoute, MepSystemType } from "@/lib/project-types";

export interface PipeSizingResult {
  routeId: string;
  system: MepSystemType;
  pathLengthM: number;
  diameterMm: number;
  velocityMs: number;
  pressureDropKpa: number;
}

const DEFAULT_VELOCITY_MS: Partial<Record<MepSystemType, number>> = {
  hvac: 2.5,
  plumbing_supply: 1.5,
  plumbing_drain: 1.2,
  fire: 2.0,
  electrical: 0,
  elv: 0
};

const ROUGHNESS_FACTOR: Partial<Record<MepSystemType, number>> = {
  hvac: 0.03,
  plumbing_supply: 0.025,
  plumbing_drain: 0.035,
  fire: 0.03
};

function pathLength(path: MepRoute["path"]) {
  return path.slice(1).reduce((total, point, index) => {
    const previous = path[index];
    return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function estimatePipeDiameter(flowRateLps: number, maxVelocityMs = 2.0): number {
  if (flowRateLps <= 0 || maxVelocityMs <= 0) {
    return 0;
  }

  const areaM2 = (flowRateLps / 1000) / maxVelocityMs;
  const diameterM = Math.sqrt((4 * areaM2) / Math.PI);
  const standardDiameters = [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300];

  return standardDiameters.find((size) => size >= diameterM * 1000) ?? standardDiameters[standardDiameters.length - 1]!;
}

export function estimatePressureDrop(
  pathLengthM: number,
  diameterMm: number,
  system: MepSystemType,
  flowRateLps = 1
): number {
  if (diameterMm <= 0 || pathLengthM <= 0) {
    return 0;
  }

  const velocity = DEFAULT_VELOCITY_MS[system] ?? 1.5;
  const roughness = ROUGHNESS_FACTOR[system] ?? 0.03;
  const diameterM = diameterMm / 1000;
  const reynolds = (velocity * diameterM) / 1e-6;
  const friction = reynolds > 0 ? roughness + 0.11 * (roughness / reynolds) ** 0.25 : roughness;
  const dynamicPressure = 998 * velocity ** 2 / 2;
  const dropPa = friction * (pathLengthM / diameterM) * dynamicPressure * (flowRateLps / 10 + 0.5);

  return round(dropPa / 1000, 2);
}

function defaultFlowRateForSystem(system: MepSystemType, servedRoomCount: number) {
  const rooms = Math.max(1, servedRoomCount);

  switch (system) {
    case "hvac":
      return rooms * 0.08;
    case "plumbing_supply":
      return rooms * 0.04;
    case "plumbing_drain":
      return rooms * 0.06;
    case "fire":
      return rooms * 0.12;
    default:
      return 0;
  }
}

export function sizeMepRoutes(routes: MepRoute[]): PipeSizingResult[] {
  return routes
    .filter((route) => route.system !== "electrical" && route.system !== "elv")
    .map((route) => {
      const lengthM = pathLength(route.path);
      const flowRateLps = defaultFlowRateForSystem(route.system, route.connectsRoomIds.length);
      const velocity = DEFAULT_VELOCITY_MS[route.system] ?? 1.5;
      const diameterMm = estimatePipeDiameter(flowRateLps, velocity);

      return {
        routeId: route.id,
        system: route.system,
        pathLengthM: round(lengthM),
        diameterMm,
        velocityMs: velocity,
        pressureDropKpa: estimatePressureDrop(lengthM, diameterMm, route.system, flowRateLps)
      };
    });
}
