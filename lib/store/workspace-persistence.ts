import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";

const DB_NAME = "evolab-workspace";
const DB_VERSION = 1;
const STORE_NAME = "snapshots";
export const WORKSPACE_SNAPSHOT_KEY = "current";

function openWorkspaceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB is unavailable."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open workspace DB."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "projectId" });
      }
    };
  });
}

function runWorkspaceRequest<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openWorkspaceDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = run(store);

        request.onerror = () => reject(request.error ?? new Error("Workspace persistence request failed."));
        request.onsuccess = () => resolve(request.result as T);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => reject(transaction.error ?? new Error("Workspace persistence transaction failed."));
      })
  );
}

export async function readWorkspaceSnapshot(projectId = WORKSPACE_SNAPSHOT_KEY): Promise<WorkspacePersistedSnapshot | null> {
  try {
    const record = await runWorkspaceRequest("readonly", (store) => store.get(projectId));
    return (record as WorkspacePersistedSnapshot | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function writeWorkspaceSnapshot(snapshot: WorkspacePersistedSnapshot): Promise<void> {
  await runWorkspaceRequest("readwrite", (store) => store.put(snapshot));
}

export async function clearWorkspaceSnapshot(projectId = WORKSPACE_SNAPSHOT_KEY): Promise<void> {
  try {
    await runWorkspaceRequest("readwrite", (store) => store.delete(projectId));
  } catch {
    // Ignore cleanup failures.
  }
}
