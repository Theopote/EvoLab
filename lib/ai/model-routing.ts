import type { LlmTask, LlmTier } from "@/lib/ai/llm-tasks";
import { TASK_TIER } from "@/lib/ai/llm-tasks";

export type LlmProviderName = "anthropic" | "openai" | "ollama";

const DEFAULT_MODELS: Record<LlmTier, string> = {
  light: "claude-sonnet-4-20250514",
  standard: "claude-sonnet-4-20250514",
  heavy: "claude-sonnet-4-20250514"
};

export function resolveLlmProvider(): LlmProviderName {
  const configured = process.env.EVOLAB_LLM_PROVIDER?.trim().toLowerCase();

  if (configured === "anthropic" || configured === "openai" || configured === "ollama") {
    return configured;
  }

  return "anthropic";
}

export function resolveModelForTask(task: LlmTask = "default"): string {
  const tier = TASK_TIER[task] ?? TASK_TIER.default;
  const tierEnvKey =
    tier === "light"
      ? process.env.EVOLAB_LLM_MODEL_LIGHT
      : tier === "heavy"
        ? process.env.EVOLAB_LLM_MODEL_HEAVY
        : process.env.EVOLAB_LLM_MODEL_STANDARD;

  return tierEnvKey?.trim() || DEFAULT_MODELS[tier];
}
