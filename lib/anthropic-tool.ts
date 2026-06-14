import Anthropic from "@anthropic-ai/sdk";
import { z, type ZodType } from "zod";
import { hasAnthropicKey } from "@/lib/anthropic-json";

const MODEL = "claude-sonnet-4-20250514";

interface RequestAnthropicToolOptions<T> {
  system: string;
  input: unknown;
  toolName: string;
  toolDescription: string;
  schema: ZodType<T>;
  maxTokens?: number;
}

interface AnthropicInputSchema {
  type: "object";
  properties?: unknown;
  required?: string[] | null;
  [key: string]: unknown;
}

function toAnthropicInputSchema(schema: ZodType): AnthropicInputSchema {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

  if (jsonSchema.type !== "object") {
    throw new Error("Anthropic tool input schema must be a JSON object.");
  }

  return jsonSchema as AnthropicInputSchema;
}

export async function requestAnthropicTool<T>({
  system,
  input,
  toolName,
  toolDescription,
  schema,
  maxTokens = 4096
}: RequestAnthropicToolOptions<T>): Promise<T> {
  if (!hasAnthropicKey()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  const inputSchema = toAnthropicInputSchema(schema);
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: inputSchema
      }
    ],
    tool_choice: {
      type: "tool",
      name: toolName
    },
    messages: [
      {
        role: "user",
        content: JSON.stringify(input)
      }
    ]
  });
  const toolUse = message.content.find(
    (block) => block.type === "tool_use" && block.name === toolName
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Anthropic did not return tool_use:${toolName}.`);
  }

  const parsed = schema.safeParse(toolUse.input);

  if (!parsed.success) {
    throw new Error(`Tool output failed schema validation: ${parsed.error.message}`);
  }

  return parsed.data;
}
