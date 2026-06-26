import { promises as fs } from "fs";
import path from "path";
import type { ProjectRegistryEntry } from "@/lib/project-registry";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import type { ProjectStore } from "@/lib/server/project-store/types";

function resolveDataDir() {
  return process.env.EVOLAB_PROJECT_DATA_DIR ?? path.join(process.cwd(), ".data", "projects");
}

function projectFilePath(projectId: string, dataDir = resolveDataDir()) {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(dataDir, `${safeId}.json`);
}

export class FileProjectStore implements ProjectStore {
  constructor(private readonly dataDir = resolveDataDir()) {}

  private async ensureDataDir() {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  async readSnapshot(projectId: string): Promise<WorkspacePersistedSnapshot | null> {
    try {
      const raw = await fs.readFile(projectFilePath(projectId, this.dataDir), "utf8");
      return JSON.parse(raw) as WorkspacePersistedSnapshot;
    } catch {
      return null;
    }
  }

  async writeSnapshot(snapshot: WorkspacePersistedSnapshot): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(
      projectFilePath(snapshot.projectId, this.dataDir),
      JSON.stringify(snapshot, null, 2),
      "utf8"
    );
  }

  async listSummaries(): Promise<ProjectRegistryEntry[]> {
    await this.ensureDataDir();
    const files = await fs.readdir(this.dataDir);

    const summaries = await Promise.all(
      files
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => {
          try {
            const raw = await fs.readFile(path.join(this.dataDir, file), "utf8");
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

  async deleteSnapshot(projectId: string): Promise<void> {
    try {
      await fs.unlink(projectFilePath(projectId, this.dataDir));
    } catch {
      // Ignore missing files.
    }
  }
}
