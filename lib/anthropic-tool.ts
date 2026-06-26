import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam, Message, MessageParam, TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z, type ZodType } from "zod";
import { buildLlmCacheKey, readLlmCache, writeLlmCache } from "@/lib/ai/llm-cache";
import type { LlmTask } from "@/lib/ai/llm-tasks";
import { resolveLlmProvider, resolveModelForTask } from "@/lib/ai/model-routing";
import { isLlmAvailable } from "@/lib/ai/offline-mode";
import { logLlmUsage } from "@/lib/ai/token-usage";
import type { AnthropicImageMediaType, AnthropicToolImageInput } from "@/lib/anthropic-types";
import "server-only";

export type { AnthropicImageMediaType, AnthropicToolImageInput };

interface RequestAnthropicToolOptions<T> {
  system: string;
  input: unknown;
  images?: AnthropicToolImageInput[];
  toolName: string;
  toolDescription: string;
  schema: ZodType<T>;
  maxTokens?: number;
  maxValidationRetries?: number;
  task?: LlmTask;
  route?: string;
  promptRef?: string;
  cacheInput?: unknown;
  onStreamDelta?: (text: string) => void;
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

function createUserMessage(
  input: unknown,
  correctionHint: string | undefined,
  images?: AnthropicToolImageInput[]
): MessageParam {
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

async function createAnthropicMessage(
  client: Anthropic,
  params: {
    model: string;
    maxTokens: number;
    system: string;
    toolName: string;
    toolDescription: string;
    inputSchema: AnthropicInputSchema;
    message: MessageParam;
    onStreamDelta?: (text: string) => void;
  }
): Promise<Message> {
  const request = {
    model: params.model,
    max_tokens: params.maxTokens,
    system: params.system,
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.inputSchema
      }
    ],
    tool_choice: {
      type: "tool" as const,
      name: params.toolName
    },
    messages: [params.message]
  };

  if (!params.onStreamDelta) {
    return client.messages.create(request);
  }

  const stream = client.messages.stream(request);

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta" &&
      event.delta.text
    ) {
      params.onStreamDelta(event.delta.text);
    }
  }

  return await stream.finalMessage();
}

export async function requestAnthropicTool<T>({
  system,
  input,
  images,
  toolName,
  toolDescription,
  schema,
  maxTokens = 4096,
  maxValidationRetries = 1,
  task = "default",
  route,
  promptRef,
  cacheInput,
  onStreamDelta
}: RequestAnthropicToolOptions<T>): Promise<T> {
  if (!isLlmAvailable()) {
    throw new Error("LLM is not available (offline mode or missing API key).");
  }

  if (resolveLlmProvider() !== "anthropic") {
    throw new Error(`Provider ${resolveLlmProvider()} is not implemented yet. Set EVOLAB_LLM_PROVIDER=anthropic.`);
  }

  const model = resolveModelForTask(task);
  const cacheKey =
    cacheInput !== undefined ? buildLlmCacheKey(cacheInput, promptRef ?? system) : undefined;

  if (cacheKey) {
    const cached = await readLlmCache<T>(task, cacheKey);
    if (cached !== null) {
      await logLlmUsage({
        provider: "anthropic",
        model,
        task,
        route,
        inputTokens: 0,
        outputTokens: 0,
        cacheHit: true
      });
      return cached;
    }
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  const inputSchema = toAnthropicInputSchema(schema);
  let correctionHint: string | undefined;

  for (let attempt = 0; attempt <= maxValidationRetries; attempt += 1) {
    const message = await createAnthropicMessage(client, {
      model,
      maxTokens,
      system,
      toolName,
      toolDescription,
      inputSchema,
      message: createUserMessage(input, correctionHint, images),
      onStreamDelta
    });

    await logLlmUsage({
      provider: "anthropic",
      model,
      task,
      route,
      inputTokens: message.usage?.input_tokens ?? 0,
      outputTokens: message.usage?.output_tokens ?? 0,
      cacheHit: false
    });

    const toolUse = message.content.find(
      (block) => block.type === "tool_use" && block.name === toolName
    );

    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error(`Anthropic did not return tool_use:${toolName}.`);
    }

    const parsed = schema.safeParse(toolUse.input);

    if (parsed.success) {
      if (cacheKey) {
        await writeLlmCache(task, cacheKey, parsed.data);
      }

      return parsed.data;
    }

    correctionHint = `The previous ${toolName} tool input failed runtime validation. Return corrected tool input only. Validation error: ${parsed.error.message}`;
  }

  throw new Error("Tool output failed schema validation after correction.");
}
