-- EvoLab workspace snapshot store (PostgreSQL adapter)
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
