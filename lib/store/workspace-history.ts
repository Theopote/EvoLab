import type { CopilotTimelineEntry } from "@/lib/copilot-timeline-store";
import type { DesignBrief, PlanVersion, Point, ProjectData, WorkspaceTab } from "@/lib/project-types";
import type { ZoningConstraints } from "@/lib/site-types";
import type { WorkflowPhase } from "@/lib/workflow-phases";
import type { EvoProjectStore } from "@/lib/store/types";

export interface WorkspaceHistorySnapshot {
  project: ProjectData;
  outline: Point[];
  outlineClosed: boolean;
}

export type WorkspaceUndoEntry =
  | { kind: "snapshot"; snapshot: WorkspaceHistorySnapshot }
  | {
      kind: "copilot";
      changeSetId: string;
      proposalId?: string;
      timelineEntryId?: string;
    };

export const MAX_UNDO_STACK = 64;

export function cloneWorkspaceHistorySnapshot(state: Pick<EvoProjectStore, "project" | "outline" | "outlineClosed">) {
  // 使用JSON深拷贝，避免structuredClone对某些对象的限制
  return JSON.parse(JSON.stringify({
    project: state.project,
    outline: state.outline,
    outlineClosed: state.outlineClosed
  })) as WorkspaceHistorySnapshot;
}

export function pushUserEditUndoSnapshot(state: EvoProjectStore) {
  state.undoStack.push({
    kind: "snapshot",
    snapshot: cloneWorkspaceHistorySnapshot(state)
  });

  if (state.undoStack.length > MAX_UNDO_STACK) {
    state.undoStack.shift();
  }

  state.redoStack.length = 0;
}

export function pushCopilotUndoEntry(
  state: EvoProjectStore,
  input: { changeSetId: string; proposalId?: string; timelineEntryId?: string }
) {
  state.undoStack.push({
    kind: "copilot",
    changeSetId: input.changeSetId,
    proposalId: input.proposalId,
    timelineEntryId: input.timelineEntryId
  });

  if (state.undoStack.length > MAX_UNDO_STACK) {
    state.undoStack.shift();
  }

  state.redoStack.length = 0;
}

export function attachTimelineEntryToLatestCopilotUndo(state: EvoProjectStore, timelineEntryId: string) {
  for (let index = state.undoStack.length - 1; index >= 0; index -= 1) {
    const entry = state.undoStack[index];

    if (entry?.kind === "copilot" && !entry.timelineEntryId) {
      entry.timelineEntryId = timelineEntryId;
      return;
    }
  }
}

export function restoreWorkspaceHistorySnapshot(
  state: EvoProjectStore,
  snapshot: WorkspaceHistorySnapshot
) {
  state.project = JSON.parse(JSON.stringify(snapshot.project));
  state.outline = JSON.parse(JSON.stringify(snapshot.outline));
  state.outlineClosed = snapshot.outlineClosed;
}

export interface WorkspacePersistedSnapshot {
  projectId: string;
  savedAt: string;
  project: ProjectData;
  brief: DesignBrief;
  workflowPhase: WorkflowPhase;
  activeTab: WorkspaceTab;
  outline: Point[];
  outlineClosed: boolean;
  zoning: ZoningConstraints;
  undoStack?: WorkspaceUndoEntry[];
  copilotTimelineEntries?: CopilotTimelineEntry[];
}

export function buildWorkspacePersistedSnapshot(
  state: Pick<
    EvoProjectStore,
    "project" | "brief" | "workflowPhase" | "activeTab" | "outline" | "outlineClosed" | "zoning" | "undoStack"
  >,
  copilotTimelineEntries: CopilotTimelineEntry[] = []
): WorkspacePersistedSnapshot {
  return {
    projectId: state.project.projectId,
    savedAt: new Date().toISOString(),
    project: JSON.parse(JSON.stringify(state.project)),
    brief: JSON.parse(JSON.stringify(state.brief)),
    workflowPhase: state.workflowPhase,
    activeTab: state.activeTab,
    outline: JSON.parse(JSON.stringify(state.outline)),
    outlineClosed: state.outlineClosed,
    zoning: JSON.parse(JSON.stringify(state.zoning)),
    undoStack: JSON.parse(JSON.stringify(state.undoStack)),
    copilotTimelineEntries: JSON.parse(JSON.stringify(copilotTimelineEntries))
  };
}
