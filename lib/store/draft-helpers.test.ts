import { describe, expect, it } from "vitest";
import { clearSelectionDraft, validateSelectionDraft } from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";

function selectionState(overrides: Partial<EvoProjectStore> = {}): EvoProjectStore {
  return {
    selectionType: "room",
    selectedRoomId: "room-1",
    selectedWallId: "wall-1",
    selectedOpeningId: "opening-1",
    activeVersion: undefined,
    activeLevel: undefined,
    ...overrides
  } as EvoProjectStore;
}

describe("selection draft helpers", () => {
  it("clearSelectionDraft resets all selection fields", () => {
    const state = selectionState();

    clearSelectionDraft(state);

    expect(state.selectionType).toBe("none");
    expect(state.selectedRoomId).toBeUndefined();
    expect(state.selectedWallId).toBeUndefined();
    expect(state.selectedOpeningId).toBeUndefined();
    expect(state.selectedRoom).toBeUndefined();
    expect(state.selectedWall).toBeUndefined();
    expect(state.selectedOpening).toBeUndefined();
  });

  it("validateSelectionDraft clears stale room selection when version is missing", () => {
    const state = selectionState({ selectionType: "room", selectedRoomId: "room-1" });

    validateSelectionDraft(state);

    expect(state.selectionType).toBe("none");
  });
});
