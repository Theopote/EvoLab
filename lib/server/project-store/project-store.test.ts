import {
  createProjectStore,
  getProjectStore,
  resetProjectStoreForTests,
  resolveProjectStoreMode
} from "@/lib/server/project-store";
import { FileProjectStore } from "@/lib/server/project-store/file-project-store";
import { buildWorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import { createInitialState } from "@/lib/store/initial-state";
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";

function buildSnapshot(projectId: string, savedAt: string) {
  const state = createInitialState();
  state.project.projectId = projectId;
  state.project.projectName = `Project ${projectId}`;

  return {
    ...buildWorkspacePersistedSnapshot(state),
    projectId,
    savedAt
  };
}

describe("FileProjectStore", () => {
  let dataDir: string;

  afterEach(async () => {
    resetProjectStoreForTests();
    if (dataDir) {
      await rm(dataDir, { recursive: true, force: true });
    }
  });

  it("round-trips workspace snapshots", async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "evolab-project-store-"));
    const store = new FileProjectStore(dataDir);
    const snapshot = buildSnapshot("proj-a", "2026-06-27T10:00:00.000Z");

    await store.writeSnapshot(snapshot);

    const loaded = await store.readSnapshot("proj-a");
    expect(loaded?.projectId).toBe("proj-a");
    expect(loaded?.project.projectName).toBe("Project proj-a");
    expect(loaded?.project.versions.length).toBeGreaterThan(0);
  });

  it("lists summaries sorted by savedAt", async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "evolab-project-store-"));
    const store = new FileProjectStore(dataDir);

    await store.writeSnapshot(buildSnapshot("older", "2026-06-27T08:00:00.000Z"));
    await store.writeSnapshot(buildSnapshot("newer", "2026-06-27T12:00:00.000Z"));

    const summaries = await store.listSummaries();
    expect(summaries.map((entry) => entry.projectId)).toEqual(["newer", "older"]);
    expect(summaries[0]?.versionCount).toBeGreaterThan(0);
  });

  it("deletes snapshots", async () => {
    dataDir = await mkdtemp(path.join(os.tmpdir(), "evolab-project-store-"));
    const store = new FileProjectStore(dataDir);
    await store.writeSnapshot(buildSnapshot("to-delete", "2026-06-27T10:00:00.000Z"));

    await store.deleteSnapshot("to-delete");

    expect(await store.readSnapshot("to-delete")).toBeNull();
  });
});

describe("project store factory", () => {
  afterEach(() => {
    resetProjectStoreForTests();
  });

  it("defaults to file mode without database url", () => {
    const previousStore = process.env.EVOLAB_PROJECT_STORE;
    const previousUrl = process.env.EVOLAB_DATABASE_URL;
    delete process.env.EVOLAB_PROJECT_STORE;
    delete process.env.EVOLAB_DATABASE_URL;
    delete process.env.DATABASE_URL;

    expect(resolveProjectStoreMode()).toBe("file");
    expect(createProjectStore("file")).toBeInstanceOf(FileProjectStore);

    if (previousStore) {
      process.env.EVOLAB_PROJECT_STORE = previousStore;
    }
    if (previousUrl) {
      process.env.EVOLAB_DATABASE_URL = previousUrl;
    }
  });

  it("returns singleton from getProjectStore", () => {
    resetProjectStoreForTests();
    const first = getProjectStore();
    const second = getProjectStore();
    expect(first).toBe(second);
  });
});
