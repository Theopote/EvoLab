import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";

export function hasAnthropicKey() {
  if (process.env.NEXT_PUBLIC_MOCK_MODE === "true") return false;
  const key = process.env.ANTHROPIC_API_KEY;
  return Boolean(key && key !== "your_key_here");
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

export async function requestAnthropicJson<T>({
  system,
  input,
  maxTokens = 4096
}: {
  system: string;
  input: unknown;
  maxTokens?: number;
}): Promise<T> {
  if (!hasAnthropicKey()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ]
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return JSON.parse(extractJsonText(text)) as T;
}
