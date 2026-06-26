import { promises as fs } from "fs";
import path from "path";
import type { ProjectRegistryEntry } from "@/lib/project-registry";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";

const DATA_DIR = path.join(process.cwd(), ".data", "projects");

function projectFilePath(projectId: string) {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safeId}.json`);
}

export async function ensureProjectDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readProjectSnapshotFromDisk(projectId: string): Promise<WorkspacePersistedSnapshot | null> {
  try {
    const raw = await fs.readFile(projectFilePath(projectId), "utf8");
    return JSON.parse(raw) as WorkspacePersistedSnapshot;
  } catch {
    return null;
  }
}

export async function writeProjectSnapshotToDisk(snapshot: WorkspacePersistedSnapshot): Promise<void> {
  await ensureProjectDataDir();
  await fs.writeFile(projectFilePath(snapshot.projectId), JSON.stringify(snapshot, null, 2), "utf8");
}

export async function listProjectSummariesFromDisk(): Promise<ProjectRegistryEntry[]> {
  await ensureProjectDataDir();
  const files = await fs.readdir(DATA_DIR);

  const summaries = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        try {
          const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
          const snapshot = JSON.parse(raw) as WorkspacePersistedSnapshot;
          return {
            projectId: snapshot.projectId,
            projectName: snapshot.project.projectName,
            projectType: snapshot.project.projectType,
            versionCount: snapshot.project.versions.length,
            lastAccessedAt: snapshot.savedAt
          } satisfies ProjectRegistryEntry;
        } catch {
          return null;
        }
      })
  );

  return summaries
    .filter((item): item is ProjectRegistryEntry => item !== null)
    .sort((left, right) => right.lastAccessedAt.localeCompare(left.lastAccessedAt));
}

export async function deleteProjectSnapshotFromDisk(projectId: string): Promise<void> {
  try {
    await fs.unlink(projectFilePath(projectId));
  } catch {
    // Ignore missing files.
  }
}
