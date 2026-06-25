export {
  createSetbackBoundary,
  insetPolygon,
  offsetPolygon,
  outsetPolygon,
  type OffsetJoinType,
  type PolygonOffsetOptions,
  type SetbackBoundary
} from "@/lib/geometry/operations/offset";
export {
  canSplitRectRoom,
  findMergeableNeighborIds,
  mergeAdjacentRooms,
  roomsShareInteriorWall,
  splitRectRoom
} from "@/lib/geometry/operations/room-topology";
