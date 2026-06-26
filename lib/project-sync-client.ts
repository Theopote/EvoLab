import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import {
  mergeProjectSummaries,
  readProjectRegistry,
  type ProjectRegistryEntry
} from "@/lib/project-registry";

export async function fetchProjectSnapshot(projectId: string): Promise<WorkspacePersistedSnapshot | null> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "GET",
      cache: "no-store"
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as WorkspacePersistedSnapshot;
  } catch {
    return null;
  }
}

export async function saveProjectSnapshot(snapshot: WorkspacePersistedSnapshot): Promise<boolean> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(snapshot.projectId)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(snapshot)
    });

    return response.ok;
  } catch {
    return false;
  }
}

export async function listRemoteProjects(): Promise<ProjectRegistryEntry[]> {
  try {
    const response = await fetch("/api/projects", { cache: "no-store" });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      projects?: ProjectRegistryEntry[];
    };

    return payload.projects ?? [];
  } catch {
    return [];
  }
}

export async function listLauncherProjects(limit = 5): Promise<ProjectRegistryEntry[]> {
  const remote = await listRemoteProjects();
  const local = readProjectRegistry();
  return mergeProjectSummaries(remote, local, limit);
}
