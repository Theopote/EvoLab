import { describe, expect, it } from "vitest";
import { buildLlmCacheKey, readLlmCache, writeLlmCache } from "@/lib/ai/llm-cache";
import { mkdtemp, rm } from "fs/promises";
import path from "path";
import os from "os";

describe("llm cache", () => {
  it("builds stable cache keys", () => {
    const first = buildLlmCacheKey({ b: 2, a: 1 }, "generate-plan-topology@v2");
    const second = buildLlmCacheKey({ a: 1, b: 2 }, "generate-plan-topology@v2");
    expect(first).toBe(second);
  });

  it("round-trips cached values", async () => {
    const previousCacheRoot = process.env.EVOLAB_LLM_CACHE_DIR;
    const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "evolab-llm-cache-"));
    process.env.EVOLAB_LLM_CACHE_DIR = cacheRoot;

    const key = buildLlmCacheKey({ projectType: "office" });
    await writeLlmCache("generate-plan-topology", key, { versions: ["v1"] });
    const cached = await readLlmCache<{ versions: string[] }>("generate-plan-topology", key);

    expect(cached).toEqual({ versions: ["v1"] });

    if (previousCacheRoot) {
      process.env.EVOLAB_LLM_CACHE_DIR = previousCacheRoot;
    } else {
      delete process.env.EVOLAB_LLM_CACHE_DIR;
    }

    await rm(cacheRoot, { recursive: true, force: true });
  });
});
