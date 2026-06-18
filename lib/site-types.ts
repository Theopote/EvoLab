import type { Point } from "@/lib/project-types";

export interface SiteAddress {
  query: string;
  displayName: string;
  lat: number;
  lon: number;
}

export interface SiteBuildingFootprint {
  id: string;
  name?: string;
  heightMeters: number;
  polygon: Point[];
}

export interface SiteRoadSegment {
  id: string;
  name?: string;
  kind: string;
  points: Point[];
}

export interface TerrainSample {
  x: number;
  y: number;
  elevationMeters: number;
}

export interface SiteContext {
  address: SiteAddress;
  radiusMeters: number;
  origin: SiteAddress;
  suggestedOutline: Point[];
  buildings: SiteBuildingFootprint[];
  roads: SiteRoadSegment[];
  terrain: TerrainSample[];
  fetchedAt: string;
  source: "openstreetmap" | "mock";
}

export interface ZoningConstraints {
  setbackMeters: number;
  maxHeightMeters: number;
  maxCoverageRatio: number;
  maxFar: number;
}

export interface BuildableEnvelope {
  footprint: Point[];
  maxHeightMeters: number;
  maxFloorAreaSqm: number;
  volumeCubicMeters: number;
  valid: boolean;
}

export interface EnvironmentGridCell {
  x: number;
  y: number;
  sunHours: number;
  windShelter: number;
}

export interface EnvironmentSurrogate {
  gridSize: number;
  cells: EnvironmentGridCell[];
  dominantWindFrom: "north" | "south" | "east" | "west";
  computedAt: string;
}

export const defaultZoningConstraints: ZoningConstraints = {
  setbackMeters: 5,
  maxHeightMeters: 24,
  maxCoverageRatio: 0.65,
  maxFar: 3
};
