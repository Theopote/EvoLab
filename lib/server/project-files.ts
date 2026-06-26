import { getProjectStore } from "@/lib/server/project-store";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";

export async function ensureProjectDataDir() {
  // Kept for backward compatibility with callers that pre-create storage.
  await listProjectSummaries();
}

export async function readProjectSnapshotFromDisk(projectId: string): Promise<WorkspacePersistedSnapshot | null> {
  return readProjectSnapshot(projectId);
}

export async function writeProjectSnapshotToDisk(snapshot: WorkspacePersistedSnapshot): Promise<void> {
  await writeProjectSnapshot(snapshot);
}

export async function listProjectSummariesFromDisk() {
  return listProjectSummaries();
}

export async function deleteProjectSnapshotFromDisk(projectId: string): Promise<void> {
  await deleteProjectSnapshot(projectId);
}

export async function readProjectSnapshot(projectId: string): Promise<WorkspacePersistedSnapshot | null> {
  return getProjectStore().readSnapshot(projectId);
}

export async function writeProjectSnapshot(snapshot: WorkspacePersistedSnapshot): Promise<void> {
  await getProjectStore().writeSnapshot(snapshot);
}

export async function listProjectSummaries() {
  return getProjectStore().listSummaries();
}

export async function deleteProjectSnapshot(projectId: string): Promise<void> {
  await getProjectStore().deleteSnapshot(projectId);
}
