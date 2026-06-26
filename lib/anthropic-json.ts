import Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@anthropic-ai/sdk/resources/messages";
import { isLlmAvailable, isOfflineLlmMode } from "@/lib/ai/offline-mode";
import { resolveLlmProvider, resolveModelForTask } from "@/lib/ai/model-routing";
import { logLlmUsage } from "@/lib/ai/token-usage";
import type { LlmTask } from "@/lib/ai/llm-tasks";

export function hasAnthropicKey() {
  return isLlmAvailable();
}

export function isOfflineMode() {
  return isOfflineLlmMode();
}

function extractJsonText(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");

  if (firstObject >= 0 && lastObject > firstObject) {
    return trimmed.slice(firstObject, lastObject + 1);
  }

  return trimmed;
}

async function createAnthropicClient() {
  if (!isLlmAvailable()) {
    throw new Error("LLM is not available (offline mode or missing API key).");
  }

  if (resolveLlmProvider() !== "anthropic") {
    throw new Error(`Provider ${resolveLlmProvider()} is not implemented yet. Set EVOLAB_LLM_PROVIDER=anthropic.`);
  }

  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
}

async function logMessageUsage(message: Message, task: LlmTask, route?: string) {
  await logLlmUsage({
    provider: "anthropic",
    model: message.model,
    task,
    route,
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
    cacheHit: false
  });
}

export async function requestAnthropicJson<T>({
  system,
  input,
  maxTokens = 4096,
  task = "default",
  route
}: {
  system: string;
  input: unknown;
  maxTokens?: number;
  task?: LlmTask;
  route?: string;
}): Promise<T> {
  const client = await createAnthropicClient();
  const model = resolveModelForTask(task);

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ]
  });

  await logMessageUsage(message, task, route);

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return JSON.parse(extractJsonText(text)) as T;
}

export async function requestAnthropicText({
  system,
  prompt,
  maxTokens = 4096,
  task = "default",
  route,
  onStreamDelta
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
  task?: LlmTask;
  route?: string;
  onStreamDelta?: (text: string) => void;
}): Promise<string> {
  const client = await createAnthropicClient();
  const model = resolveModelForTask(task);
  const request = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: "user" as const,
        content: prompt
      }
    ]
  };

  let message: Message;

  if (onStreamDelta) {
    const stream = client.messages.stream(request);

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta" &&
        event.delta.text
      ) {
        onStreamDelta(event.delta.text);
      }
    }

    message = await stream.finalMessage();
  } else {
    message = await client.messages.create(request);
  }

  await logMessageUsage(message, task, route);

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
