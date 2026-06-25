import { produce } from "immer";
import {
  clearSelectionDraft,
  refreshDerivedDraft
} from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";
import type { SelectionSliceActions } from "@/lib/store/slice-types";
import type { StateCreator } from "zustand";

export const createSelectionSlice: StateCreator<EvoProjectStore, [], [], SelectionSliceActions> = (set) => ({
  selectRoom: (roomId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectionType = "room";
        state.selectedRoomId = roomId;
        state.selectedWallId = undefined;
        state.selectedOpeningId = undefined;
        refreshDerivedDraft(state);
      })
    ),
  selectWall: (wallId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectionType = "wall";
        state.selectedWallId = wallId;
        state.selectedRoomId = undefined;
        state.selectedOpeningId = undefined;
        refreshDerivedDraft(state);
      })
    ),
  selectOpening: (openingId) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.selectionType = "opening";
        state.selectedOpeningId = openingId;
        state.selectedRoomId = undefined;
        state.selectedWallId = undefined;
        refreshDerivedDraft(state);
      })
    ),
  clearSelection: () =>
    set(
      produce<EvoProjectStore>((state) => {
        clearSelectionDraft(state);
      })
    ),
  toggleElementLock: (elementId) =>
    set(
      produce<EvoProjectStore>((state) => {
        const locked = state.project.domain.lockedElementIds;
        state.project.domain.lockedElementIds = locked.includes(elementId)
          ? locked.filter((id) => id !== elementId)
          : [...locked, elementId];
      })
    )
});
