import { useCopilotTimelineStore } from "@/lib/copilot-timeline-store";
import { recordProjectAccess } from "@/lib/project-registry";
import { saveProjectSnapshot } from "@/lib/project-sync-client";
import { useEvoProjectStore } from "@/lib/store/store";
import { buildWorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import { writeWorkspaceSnapshot } from "@/lib/store/workspace-persistence";

export async function flushCurrentWorkspaceSnapshot(): Promise<boolean> {
  const snapshot = buildWorkspacePersistedSnapshot(
    useEvoProjectStore.getState(),
    useCopilotTimelineStore.getState().entries
  );

  await writeWorkspaceSnapshot(snapshot);
  recordProjectAccess(snapshot.project);
  return saveProjectSnapshot(snapshot);
}
