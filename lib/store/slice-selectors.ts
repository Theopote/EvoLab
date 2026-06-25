import type { EvoProjectStore } from "@/lib/store/types";

/** Selection IDs only — avoids re-rendering canvas when selectedRoom/Wall objects refresh. */
export function pickSelectionIds(state: EvoProjectStore) {
  return {
    selectedRoomId: state.selectedRoomId,
    selectedWallId: state.selectedWallId,
    selectedOpeningId: state.selectedOpeningId
  };
}

export function pickFloorPlanEditorState(state: EvoProjectStore) {
  return {
    ...pickSelectionIds(state),
    activeLevelId: state.activeLevelId,
    lockedElementIds: state.project.domain.lockedElementIds
  };
}
