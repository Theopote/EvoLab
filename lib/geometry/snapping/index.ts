export {
  clusterPoint,
  DEFAULT_CLUSTER_TOLERANCE,
  pointsNear,
  quantizeCoordinate,
  quantizePoint,
  quantizePointCoords
} from "@/lib/geometry/snapping/endpoints";
export { snapGridCoordinate, snapPoint, type GridSnapStep, type SnapPointOptions } from "@/lib/geometry/snapping/grid";
export { constrainOrthoDelta, type SnapDeltaOptions } from "@/lib/geometry/snapping/ortho";
export { projectDeltaOntoNormal, wallUnitNormal } from "@/lib/geometry/snapping/wall";
