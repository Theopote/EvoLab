export type { Geometry, Polygon, Ring } from "martinez-polygon-clipping";

export {
  intersectPolygons,
  intersectionArea,
  isPolygonInside,
  outsideArea,
  subtractPolygons,
  unitePolygons
} from "@/lib/geometry/kernel/boolean";
export { AREA_EPSILON, geometryArea, geometryAreaSqm, polygonArea, polygonAreaSqm, ringArea } from "@/lib/geometry/kernel/measure";
export { distance, pointInPolygon, polygonCentroid } from "@/lib/geometry/kernel/point";
export { closeRing, fromPolygon, toPolygon } from "@/lib/geometry/kernel/ring";
export { simplifyPolygon } from "@/lib/geometry/kernel/simplify";
