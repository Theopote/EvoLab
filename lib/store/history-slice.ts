import { produce } from "immer";
import { refreshDerivedDraft } from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";
import type { HistorySliceActions } from "@/lib/store/slice-types";
import {
  cloneWorkspaceHistorySnapshot,
  pushUserEditUndoSnapshot,
  restoreWorkspaceHistorySnapshot,
  type WorkspacePersistedSnapshot
} from "@/lib/store/workspace-history";
import type { StateCreator } from "zustand";

export const createHistorySlice: StateCreator<EvoProjectStore, [], [], HistorySliceActions> = (set) => ({
  undoProjectEdit: () =>
    set(
      produce<EvoProjectStore>((state) => {
        const snapshot = state.undoStack.pop();
        if (!snapshot) {
          return;
        }

        state.redoStack.push(cloneWorkspaceHistorySnapshot(state));
        restoreWorkspaceHistorySnapshot(state, snapshot);
        refreshDerivedDraft(state);
      })
    ),
  redoProjectEdit: () =>
    set(
      produce<EvoProjectStore>((state) => {
        const snapshot = state.redoStack.pop();
        if (!snapshot) {
          return;
        }

        state.undoStack.push(cloneWorkspaceHistorySnapshot(state));
        restoreWorkspaceHistorySnapshot(state, snapshot);
        refreshDerivedDraft(state);
      })
    ),
  hydrateWorkspaceSnapshot: (snapshot: WorkspacePersistedSnapshot) =>
    set(
      produce<EvoProjectStore>((state) => {
        state.project = structuredClone(snapshot.project);
        state.brief = structuredClone(snapshot.brief);
        state.workflowPhase = snapshot.workflowPhase;
        state.activeTab = snapshot.activeTab;
        state.outline = structuredClone(snapshot.outline);
        state.outlineClosed = snapshot.outlineClosed;
        state.zoning = structuredClone(snapshot.zoning);
        state.undoStack = [];
        state.redoStack = [];
        refreshDerivedDraft(state);
      })
    ),
  clearEditHistory: () =>
    set(
      produce<EvoProjectStore>((state) => {
        state.undoStack = [];
        state.redoStack = [];
      })
    )
});

export { pushUserEditUndoSnapshot };
