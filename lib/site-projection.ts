import type { Point } from "@/lib/project-types";

const METERS_PER_DEG_LAT = 111_320;

export function metersPerDegLon(lat: number) {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export function latLonToLocal(lat: number, lon: number, originLat: number, originLon: number): Point {
  return [(lon - originLon) * metersPerDegLon(originLat), (lat - originLat) * METERS_PER_DEG_LAT];
}

export function localToLatLon(x: number, y: number, originLat: number, originLon: number): [number, number] {
  const lon = originLon + x / metersPerDegLon(originLat);
  const lat = originLat + y / METERS_PER_DEG_LAT;
  return [lat, lon];
}

export function translatePolygon(polygon: Point[], offsetX: number, offsetY: number): Point[] {
  return polygon.map(([x, y]) => [x + offsetX, y + offsetY]);
}

export function normalizeSiteCoordinates(
  buildings: Array<{ polygon: Point[] }>,
  roads: Array<{ points: Point[] }>,
  terrain: Array<{ x: number; y: number }>
) {
  const points: Point[] = [
    ...buildings.flatMap((building) => building.polygon),
    ...roads.flatMap((road) => road.points),
    ...terrain.map((sample) => [sample.x, sample.y] as Point)
  ];

  if (points.length === 0) {
    return { offsetX: 0, offsetY: 0 };
  }

  const minX = Math.min(...points.map(([x]) => x));
  const minY = Math.min(...points.map(([, y]) => y));
  const padding = 12;

  return {
    offsetX: padding - minX,
    offsetY: padding - minY
  };
}

export function createSuggestedOutline(width: number, height: number, padding = 12): Point[] {
  return [
    [padding, padding],
    [padding + width, padding],
    [padding + width, padding + height],
    [padding, padding + height]
  ];
}
