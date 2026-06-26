import type { PresentationDeck } from "@/lib/presentation/types";
import type { ToolSessionDetail, ToolSessionOutput } from "@/lib/tools/tool-session-types";
import { isInlineDataUrl } from "@/lib/tools/tool-session-persist";

const DB_NAME = "evolab-tool-session-details";
const DB_VERSION = 1;
const STORE_NAME = "details";

export interface ToolSessionDetailCacheOutput {
  id: string;
  referencePreviewUrl?: string;
  dataUrl?: string;
  deck?: PresentationDeck;
  briefs?: string[];
}

export interface ToolSessionDetailCacheEntry {
  sessionId: string;
  updatedAt: string;
  inputFilePreviews?: string[];
  outputs: ToolSessionDetailCacheOutput[];
}

function openDetailCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB is unavailable."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error ?? new Error("Failed to open detail cache."));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
      }
    };
  });
}

function runDetailCacheRequest<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDetailCacheDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = run(store);

        request.onerror = () => reject(request.error ?? new Error("Detail cache request failed."));
        request.onsuccess = () => resolve(request.result as T);
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => reject(transaction.error ?? new Error("Detail cache transaction failed."));
      })
  );
}

function extractOutputCache(output: ToolSessionOutput): ToolSessionDetailCacheOutput | undefined {
  switch (output.kind) {
    case "plan-version":
      if (!output.referencePreviewUrl || !isInlineDataUrl(output.referencePreviewUrl)) {
        return undefined;
      }

      return {
        id: output.id,
        referencePreviewUrl: output.referencePreviewUrl
      };
    case "file-export":
      if (!output.dataUrl) {
        return undefined;
      }

      return {
        id: output.id,
        dataUrl: output.dataUrl
      };
    case "presentation-deck":
      return {
        id: output.id,
        deck: output.deck
      };
    case "image-brief":
      if (output.briefs.length === 0) {
        return undefined;
      }

      return {
        id: output.id,
        briefs: output.briefs
      };
    default:
      return undefined;
  }
}

export function extractDetailCache(session: ToolSessionDetail): ToolSessionDetailCacheEntry | undefined {
  const inputFilePreviews = session.inputFiles
    ?.map((file) => (file.previewUrl && isInlineDataUrl(file.previewUrl) ? file.previewUrl : undefined))
    .filter((preview): preview is string => Boolean(preview));

  const outputs = session.outputs
    .map((output) => extractOutputCache(output))
    .filter((output): output is ToolSessionDetailCacheOutput => Boolean(output));

  if (!inputFilePreviews?.length && outputs.length === 0) {
    return undefined;
  }

  return {
    sessionId: session.id,
    updatedAt: session.updatedAt,
    inputFilePreviews,
    outputs
  };
}

export function mergeDetailCache(
  session: ToolSessionDetail,
  cache: ToolSessionDetailCacheEntry
): ToolSessionDetail {
  const outputCacheById = new Map(cache.outputs.map((output) => [output.id, output]));

  return {
    ...session,
    inputFiles: session.inputFiles?.map((file, index) => ({
      ...file,
      previewUrl: file.previewUrl ?? cache.inputFilePreviews?.[index]
    })),
    outputs: session.outputs.map((output) => {
      const cached = outputCacheById.get(output.id);
      if (!cached) {
        return output;
      }

      switch (output.kind) {
        case "plan-version":
          return {
            ...output,
            referencePreviewUrl: output.referencePreviewUrl ?? cached.referencePreviewUrl
          };
        case "file-export":
          return {
            ...output,
            dataUrl: output.dataUrl ?? cached.dataUrl
          };
        case "presentation-deck":
          return cached.deck
            ? {
                ...output,
                deck: cached.deck
              }
            : output;
        case "image-brief":
          return cached.briefs?.length
            ? {
                ...output,
                briefs: cached.briefs
              }
            : output;
        default:
          return output;
      }
    })
  };
}

export async function writeDetailCache(entry: ToolSessionDetailCacheEntry): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }

  await runDetailCacheRequest("readwrite", (store) => store.put(entry));
}

export async function deleteDetailCache(sessionId: string): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }

  await runDetailCacheRequest("readwrite", (store) => store.delete(sessionId));
}

export async function readAllDetailCaches(): Promise<Record<string, ToolSessionDetailCacheEntry>> {
  if (typeof indexedDB === "undefined") {
    return {};
  }

  const entries = await runDetailCacheRequest<ToolSessionDetailCacheEntry[]>("readonly", (store) => store.getAll());
  return Object.fromEntries(entries.map((entry) => [entry.sessionId, entry]));
}

export async function hydrateSessionsFromDetailCache(
  sessions: Record<string, ToolSessionDetail>
): Promise<Record<string, ToolSessionDetail>> {
  const caches = await readAllDetailCaches();
  const merged: Record<string, ToolSessionDetail> = {};

  for (const [sessionId, session] of Object.entries(sessions)) {
    const cache = caches[sessionId];
    if (cache) {
      merged[sessionId] = mergeDetailCache(session, cache);
    }
  }

  return merged;
}

export async function persistSessionDetailCache(session: ToolSessionDetail): Promise<void> {
  const entry = extractDetailCache(session);
  if (entry) {
    await writeDetailCache(entry);
    return;
  }

  await deleteDetailCache(session.id);
}
