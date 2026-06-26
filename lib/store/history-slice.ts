import { produce } from "immer";
import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import { revertCopilotProposalAfterUndo } from "@/lib/copilot-proposals";
import {
  bumpGeometryRevision,
  clearSelectionDraft,
  refreshDerivedDraft
} from "@/lib/store/draft-helpers";
import type { EvoProjectStore } from "@/lib/store/types";
import type { HistorySliceActions } from "@/lib/store/slice-types";
import { rejectChangeSetInDomain } from "@/lib/project-domain";
import {
  attachTimelineEntryToLatestCopilotUndo,
  cloneWorkspaceHistorySnapshot,
  pushCopilotUndoEntry,
  pushUserEditUndoSnapshot,
  restoreWorkspaceHistorySnapshot,
  type WorkspacePersistedSnapshot
} from "@/lib/store/workspace-history";
import type { StateCreator } from "zustand";

function applyUndoEntry(state: EvoProjectStore, entry: (typeof state.undoStack)[number]) {
  if (entry.kind === "snapshot") {
    restoreWorkspaceHistorySnapshot(state, entry.snapshot);
    return;
  }

  const changeSet = state.project.domain.changeSets.find((item) => item.id === entry.changeSetId);
  const result = rejectChangeSetInDomain(state.project.domain, entry.changeSetId, state.project.versions);
  state.project.domain = result.domain;
  state.project.versions = result.versions;
  state.project.activeVersionId = result.activeVersionId;

  if (changeSet?.proposalId) {
    state.project.domain = revertCopilotProposalAfterUndo(state.project.domain, changeSet.proposalId);
  }

  if (entry.timelineEntryId) {
    useCopilotTimelineStore.getState().markUndone(entry.timelineEntryId);
  }

  clearSelectionDraft(state);
  bumpGeometryRevision(state);
}

export const createHistorySlice: StateCreator<EvoProjectStore, [], [], HistorySliceActions> = (set) => ({
  undoProjectEdit: () =>
    set(
      produce<EvoProjectStore>((state) => {
        const entry = state.undoStack.pop();
        if (!entry) {
          return;
        }

        if (entry.kind === "snapshot") {
          state.redoStack.push({
            kind: "snapshot",
            snapshot: cloneWorkspaceHistorySnapshot(state)
          });
        }

        applyUndoEntry(state, entry);
        refreshDerivedDraft(state);
      })
    ),
  redoProjectEdit: () =>
    set(
      produce<EvoProjectStore>((state) => {
        const entry = state.redoStack.pop();
        if (!entry || entry.kind !== "snapshot") {
          return;
        }

        state.undoStack.push({
          kind: "snapshot",
          snapshot: cloneWorkspaceHistorySnapshot(state)
        });
        restoreWorkspaceHistorySnapshot(state, entry.snapshot);
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
        state.undoStack = structuredClone(snapshot.undoStack ?? []);
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

export { attachTimelineEntryToLatestCopilotUndo, pushCopilotUndoEntry, pushUserEditUndoSnapshot };
