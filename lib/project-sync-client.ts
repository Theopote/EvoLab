import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import {
  mergeProjectSummaries,
  readProjectRegistry,
  type ProjectRegistryEntry
} from "@/lib/project-registry";
import { readApiResponse, readOptionalApiResponse } from "@/lib/api-client";

export async function fetchProjectSnapshot(projectId: string): Promise<WorkspacePersistedSnapshot | null> {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: "GET",
      cache: "no-store"
    });

    return await readOptionalApiResponse<WorkspacePersistedSnapshot>(response);
  } catch {
    return null;
  }
}

export async function createProjectSnapshot(snapshot: WorkspacePersistedSnapshot): Promise<boolean> {
  try {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(snapshot)
    });

    if (!response.ok) {
      return false;
    }

    await readApiResponse<{ projectId: string }>(response);
    return true;
  } catch {
    return false;
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

    if (!response.ok) {
      return false;
    }

    await readApiResponse<{ projectId: string; savedAt: string }>(response);
    return true;
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

    const payload = await readApiResponse<{ projects: ProjectRegistryEntry[] }>(response);
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
