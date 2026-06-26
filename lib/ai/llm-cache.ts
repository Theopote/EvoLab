import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type { LlmTask } from "@/lib/ai/llm-tasks";

const CACHE_ROOT = process.env.EVOLAB_LLM_CACHE_DIR ?? path.join(process.cwd(), ".data", "llm-cache");

function cacheFilePath(namespace: string, key: string) {
  const safeNamespace = namespace.replace(/[^a-zA-Z0-9_-]/g, "_");
  const hash = createHash("sha256").update(key).digest("hex");
  return path.join(CACHE_ROOT, safeNamespace, `${hash}.json`);
}

function stableSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, current) => {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      return Object.keys(current as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((accumulator, key) => {
          accumulator[key] = (current as Record<string, unknown>)[key];
          return accumulator;
        }, {});
    }

    return current;
  });
}

export function buildLlmCacheKey(input: unknown, promptRef?: string) {
  return stableSerialize({ promptRef, input });
}

export async function readLlmCache<T>(namespace: LlmTask, key: string): Promise<T | null> {
  if (process.env.EVOLAB_LLM_CACHE === "false") {
    return null;
  }

  try {
    const raw = await fs.readFile(cacheFilePath(namespace, key), "utf8");
    const parsed = JSON.parse(raw) as { value: T };
    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export async function writeLlmCache<T>(namespace: LlmTask, key: string, value: T): Promise<void> {
  if (process.env.EVOLAB_LLM_CACHE === "false") {
    return;
  }

  const filePath = cacheFilePath(namespace, key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ value, savedAt: new Date().toISOString() }), "utf8");
}
