import { insetPolygon, offsetPolygon } from "@/lib/polygon-offset";

export type { Geometry, Polygon } from "martinez-polygon-clipping";

export {
  geometryArea,
  geometryAreaSqm,
  intersectPolygons,
  pointInPolygon,
  polygonArea,
  polygonAreaSqm,
  simplifyPolygon,
  subtractPolygons,
  unitePolygons
} from "@/lib/geometry/kernel";

export function insetBoundary(points: Parameters<typeof insetPolygon>[0], distance: number) {
  return insetPolygon(points, distance);
}

export function outsetBoundary(points: Parameters<typeof offsetPolygon>[0], distance: number) {
  return offsetPolygon(points, distance);
}
