import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/store/initial-state";
import { pushUserEditUndoSnapshot } from "@/lib/store/workspace-history";
import type { EvoProjectStore } from "@/lib/store/types";

describe("workspace edit history", () => {
  it("captures project snapshots on the undo stack", () => {
    const state = {
      ...createInitialState(),
      undoStack: [],
      redoStack: []
    } as EvoProjectStore;
    const originalName = state.project.projectName;

    pushUserEditUndoSnapshot(state);
    state.project = {
      ...state.project,
      projectName: "Edited Project"
    };

    expect(state.undoStack).toHaveLength(1);
    expect(state.project.projectName).toBe("Edited Project");
    expect(state.undoStack[0]?.project.projectName).toBe(originalName);
    expect(state.redoStack).toHaveLength(0);
  });
});
