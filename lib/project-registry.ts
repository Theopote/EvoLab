import type { ProjectData } from "@/lib/project-types";

const STORAGE_KEY = "evolab.project.registry";

export interface ProjectRegistryEntry {
  projectId: string;
  projectName: string;
  projectType: string;
  versionCount: number;
  lastAccessedAt: string;
}

export function readProjectRegistry(): ProjectRegistryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as ProjectRegistryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeProjectRegistry(entries: ProjectRegistryEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function recordProjectAccess(project: Pick<ProjectData, "projectId" | "projectName" | "projectType" | "versions">) {
  const entries = readProjectRegistry().filter((entry) => entry.projectId !== project.projectId);
  const next: ProjectRegistryEntry = {
    projectId: project.projectId,
    projectName: project.projectName,
    projectType: project.projectType,
    versionCount: project.versions.length,
    lastAccessedAt: new Date().toISOString()
  };

  writeProjectRegistry([next, ...entries].slice(0, 8));
}

export function listRecentProjects(limit = 5) {
  return readProjectRegistry().slice(0, limit);
}
