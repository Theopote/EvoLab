import type { DesignBrief, PlanVersion, Point, ProjectData, WorkspaceTab } from "@/lib/project-types";
import type { ZoningConstraints } from "@/lib/site-types";
import type { WorkflowPhase } from "@/lib/workflow-phases";
import type { EvoProjectStore } from "@/lib/store/types";

export interface WorkspaceHistorySnapshot {
  project: ProjectData;
  outline: Point[];
  outlineClosed: boolean;
}

export const MAX_UNDO_STACK = 64;

export function cloneWorkspaceHistorySnapshot(state: Pick<EvoProjectStore, "project" | "outline" | "outlineClosed">) {
  return structuredClone({
    project: state.project,
    outline: state.outline,
    outlineClosed: state.outlineClosed
  }) satisfies WorkspaceHistorySnapshot;
}

export function pushUserEditUndoSnapshot(state: EvoProjectStore) {
  const snapshot = cloneWorkspaceHistorySnapshot(state);
  state.undoStack.push(snapshot);

  if (state.undoStack.length > MAX_UNDO_STACK) {
    state.undoStack.shift();
  }

  state.redoStack.length = 0;
}

export function restoreWorkspaceHistorySnapshot(
  state: EvoProjectStore,
  snapshot: WorkspaceHistorySnapshot
) {
  state.project = structuredClone(snapshot.project);
  state.outline = structuredClone(snapshot.outline);
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
}

export function buildWorkspacePersistedSnapshot(
  state: Pick<
    EvoProjectStore,
    "project" | "brief" | "workflowPhase" | "activeTab" | "outline" | "outlineClosed" | "zoning"
  >
): WorkspacePersistedSnapshot {
  return {
    projectId: state.project.projectId,
    savedAt: new Date().toISOString(),
    project: structuredClone(state.project),
    brief: structuredClone(state.brief),
    workflowPhase: state.workflowPhase,
    activeTab: state.activeTab,
    outline: structuredClone(state.outline),
    outlineClosed: state.outlineClosed,
    zoning: structuredClone(state.zoning)
  };
}
