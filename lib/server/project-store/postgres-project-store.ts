import { Pool } from "pg";
import type { ProjectRegistryEntry } from "@/lib/project-registry";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import type { ProjectStore } from "@/lib/server/project-store/types";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS evolab_project_snapshots (
  project_id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL,
  version_count INTEGER NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evolab_project_snapshots_saved_at_idx
  ON evolab_project_snapshots (saved_at DESC);
`;

function resolveDatabaseUrl() {
  return process.env.EVOLAB_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : String(value);
}

export class PostgresProjectStore implements ProjectStore {
  private pool: Pool;
  private schemaReady: Promise<void> | null = null;

  constructor(connectionString = resolveDatabaseUrl()) {
    if (!connectionString) {
      throw new Error("PostgreSQL project store requires EVOLAB_DATABASE_URL or DATABASE_URL.");
    }

    this.pool = new Pool({ connectionString });
  }

  private async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = this.pool.query(SCHEMA_SQL).then(() => undefined);
    }

    return this.schemaReady;
  }

  async readSnapshot(projectId: string): Promise<WorkspacePersistedSnapshot | null> {
    await this.ensureSchema();

    const result = await this.pool.query<{ snapshot: WorkspacePersistedSnapshot }>(
      `SELECT snapshot FROM evolab_project_snapshots WHERE project_id = $1`,
      [projectId]
    );

    return result.rows[0]?.snapshot ?? null;
  }

  async writeSnapshot(snapshot: WorkspacePersistedSnapshot): Promise<void> {
    await this.ensureSchema();

    const savedAt = snapshot.savedAt ?? new Date().toISOString();

    await this.pool.query(
      `
        INSERT INTO evolab_project_snapshots (
          project_id,
          project_name,
          project_type,
          version_count,
          snapshot,
          saved_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz)
        ON CONFLICT (project_id) DO UPDATE SET
          project_name = EXCLUDED.project_name,
          project_type = EXCLUDED.project_type,
          version_count = EXCLUDED.version_count,
          snapshot = EXCLUDED.snapshot,
          saved_at = EXCLUDED.saved_at
      `,
      [
        snapshot.projectId,
        snapshot.project.projectName,
        snapshot.project.projectType,
        snapshot.project.versions.length,
        JSON.stringify({ ...snapshot, savedAt }),
        savedAt
      ]
    );
  }

  async listSummaries(): Promise<ProjectRegistryEntry[]> {
    await this.ensureSchema();

    const result = await this.pool.query<{
      project_id: string;
      project_name: string;
      project_type: string;
      version_count: number;
      saved_at: Date | string;
    }>(
      `
        SELECT project_id, project_name, project_type, version_count, saved_at
        FROM evolab_project_snapshots
        ORDER BY saved_at DESC
      `
    );

    return result.rows.map((row: {
      project_id: string;
      project_name: string;
      project_type: string;
      version_count: number;
      saved_at: Date | string;
    }) => ({
      projectId: row.project_id,
      projectName: row.project_name,
      projectType: row.project_type,
      versionCount: row.version_count,
      lastAccessedAt: toIsoString(row.saved_at)
    }));
  }

  async deleteSnapshot(projectId: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(`DELETE FROM evolab_project_snapshots WHERE project_id = $1`, [projectId]);
  }

  async close() {
    await this.pool.end();
  }
}
