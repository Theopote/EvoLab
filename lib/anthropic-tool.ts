import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z, type ZodType } from "zod";
import { hasAnthropicKey } from "@/lib/anthropic-json";

const MODEL = "claude-sonnet-4-20250514";

export type AnthropicImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export interface AnthropicToolImageInput {
  base64: string;
  mediaType: AnthropicImageMediaType;
}

interface RequestAnthropicToolOptions<T> {
  system: string;
  input: unknown;
  images?: AnthropicToolImageInput[];
  toolName: string;
  toolDescription: string;
  schema: ZodType<T>;
  maxTokens?: number;
  maxValidationRetries?: number;
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

function createUserMessage(input: unknown, correctionHint: string | undefined, images?: AnthropicToolImageInput[]): MessageParam {
  const textBlock: TextBlockParam = {
    type: "text",
    text: JSON.stringify({
      input,
      correction: correctionHint
    })
  };

  if (!images?.length) {
    return {
      role: "user",
      content: textBlock.text
    };
  }

  const imageBlocks: ImageBlockParam[] = images.map((image) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: image.mediaType,
      data: image.base64
    }
  }));

  return {
    role: "user",
    content: [...imageBlocks, textBlock]
  };
}

export async function requestAnthropicTool<T>({
  system,
  input,
  images,
  toolName,
  toolDescription,
  schema,
  maxTokens = 4096,
  maxValidationRetries = 1
}: RequestAnthropicToolOptions<T>): Promise<T> {
  if (!hasAnthropicKey()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  const inputSchema = toAnthropicInputSchema(schema);
  let correctionHint: string | undefined;

  for (let attempt = 0; attempt <= maxValidationRetries; attempt += 1) {
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
      messages: [createUserMessage(input, correctionHint, images)]
    });
    const toolUse = message.content.find(
      (block) => block.type === "tool_use" && block.name === toolName
    );

    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error(`Anthropic did not return tool_use:${toolName}.`);
    }

    const parsed = schema.safeParse(toolUse.input);

    if (parsed.success) {
      return parsed.data;
    }

    correctionHint = `The previous ${toolName} tool input failed runtime validation. Return corrected tool input only. Validation error: ${parsed.error.message}`;
  }

  throw new Error(`Tool output failed schema validation after correction.`);
}
