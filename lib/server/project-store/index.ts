import { FileProjectStore } from "@/lib/server/project-store/file-project-store";
import { PostgresProjectStore } from "@/lib/server/project-store/postgres-project-store";
import type { ProjectStore } from "@/lib/server/project-store/types";

export type ProjectStoreMode = "file" | "postgres";

function resolveDatabaseUrl() {
  return process.env.EVOLAB_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
}

export function resolveProjectStoreMode(): ProjectStoreMode {
  const configured = process.env.EVOLAB_PROJECT_STORE?.trim().toLowerCase();

  if (configured === "file" || configured === "postgres") {
    return configured;
  }

  return resolveDatabaseUrl() ? "postgres" : "file";
}

let singletonStore: ProjectStore | null = null;

export function getProjectStore(): ProjectStore {
  if (!singletonStore) {
    singletonStore = createProjectStore();
  }

  return singletonStore;
}

export function createProjectStore(mode = resolveProjectStoreMode()): ProjectStore {
  if (mode === "postgres") {
    return new PostgresProjectStore();
  }

  return new FileProjectStore();
}

export function resetProjectStoreForTests() {
  singletonStore = null;
}

export type { ProjectStore } from "@/lib/server/project-store/types";
