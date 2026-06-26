import { promises as fs } from "fs";
import path from "path";
import type { LlmTask } from "@/lib/ai/llm-tasks";
import type { LlmProviderName } from "@/lib/ai/model-routing";
import "server-only";

export interface LlmUsageRecord {
  timestamp: string;
  provider: LlmProviderName;
  model: string;
  task: LlmTask;
  route?: string;
  inputTokens: number;
  outputTokens: number;
  cacheHit: boolean;
}

export interface LlmUsageSummary {
  totalRequests: number;
  cacheHits: number;
  inputTokens: number;
  outputTokens: number;
  byTask: Record<string, { requests: number; inputTokens: number; outputTokens: number }>;
  recent: LlmUsageRecord[];
}

const USAGE_DIR = path.join(process.cwd(), ".data", "llm-usage");
const USAGE_FILE = path.join(USAGE_DIR, "usage.jsonl");
const MAX_RECENT = 200;

const memoryRecent: LlmUsageRecord[] = [];

export async function logLlmUsage(record: Omit<LlmUsageRecord, "timestamp">) {
  const entry: LlmUsageRecord = {
    ...record,
    timestamp: new Date().toISOString()
  };

  memoryRecent.push(entry);
  if (memoryRecent.length > MAX_RECENT) {
    memoryRecent.shift();
  }

  try {
    await fs.mkdir(USAGE_DIR, { recursive: true });
    await fs.appendFile(USAGE_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Usage logging should never break AI routes.
  }
}

export function getLlmUsageSummary(): LlmUsageSummary {
  const byTask: LlmUsageSummary["byTask"] = {};
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheHits = 0;

  for (const record of memoryRecent) {
    inputTokens += record.inputTokens;
    outputTokens += record.outputTokens;
    if (record.cacheHit) {
      cacheHits += 1;
    }

    const bucket = byTask[record.task] ?? { requests: 0, inputTokens: 0, outputTokens: 0 };
    bucket.requests += 1;
    bucket.inputTokens += record.inputTokens;
    bucket.outputTokens += record.outputTokens;
    byTask[record.task] = bucket;
  }

  return {
    totalRequests: memoryRecent.length,
    cacheHits,
    inputTokens,
    outputTokens,
    byTask,
    recent: [...memoryRecent].reverse().slice(0, 50)
  };
}
