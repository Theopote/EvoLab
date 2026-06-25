export { shouldPreserveAuthoritativeWalls, openingsAlignWithWalls } from "@/lib/geometry/walls/authoritative-walls";
export { resolveLevelWalls, resolveLevelRawOpenings } from "@/lib/geometry/walls/resolve-level-walls";
export {
  reconcileAuthoritativeWalls,
  syncLevelGeometryFromRooms,
  syncLevelWallsFromRooms,
  wallsAlignWithRoomGraph
} from "@/lib/geometry/walls/sync-walls-from-rooms";
export { findWallEdgeForWall, updateWallEndpoints } from "@/lib/geometry/walls/sync-rooms-from-walls";
export { applyLevelWallDrag } from "@/lib/geometry/walls/apply-wall-drag";
export { applyWallGeometryPatch } from "@/lib/geometry/walls/apply-wall-geometry";
export { applyLevelWallMerge, applyLevelWallSplit, findMergeableWallIds } from "@/lib/geometry/walls/apply-wall-topology";
export {
  canMergeWalls,
  mergeWalls,
  remapOpeningsForWallChange,
  splitWallAtParam
} from "@/lib/geometry/walls/merge-split";
