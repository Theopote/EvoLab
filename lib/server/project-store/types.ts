import type { ProjectRegistryEntry } from "@/lib/project-registry";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";

export interface ProjectStore {
  readSnapshot(projectId: string): Promise<WorkspacePersistedSnapshot | null>;
  writeSnapshot(snapshot: WorkspacePersistedSnapshot): Promise<void>;
  listSummaries(): Promise<ProjectRegistryEntry[]>;
  deleteSnapshot(projectId: string): Promise<void>;
}
