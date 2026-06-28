import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { apiError, apiOk } from "@/lib/server/api-response";
import {
  generateSlideContentPrompt,
  generateSlideContentTool
} from "@/lib/presentation-studio/prompts";
import {
  GenerateSlideContentRequestSchema,
  StudioSlideSchema,
  type GenerateSlideContentRequest,
  type GenerateSlideContentResponse,
  type StudioSlide
} from "@/lib/presentation-studio/types";

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = GenerateSlideContentRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid generate slide content request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data as GenerateSlideContentRequest;

  try {
    // 构建AI输入
    const aiInput = {
      outlineItem: body.outlineItem,
      previousSlide: body.previousSlide,
      tone: body.tone ?? "professional",
      length: body.length ?? "moderate",
      includeImage: body.includeImage ?? false
    };

    // 调用AI生成内容
    const contentResult = await requestAnthropicTool({
      system: generateSlideContentPrompt,
      input: aiInput,
      toolName: generateSlideContentTool.name,
      toolDescription: generateSlideContentTool.description,
      schema: StudioSlideSchema.partial(),
      maxTokens: 2048,
      task: "presentation-content"
    });

    // 构建完整的幻灯片对象
    const slide: StudioSlide = {
      id: body.slideId,
      order: 0, // 将由store设置
      type: body.outlineItem.type,
      status: "generated",

      title: contentResult.title ?? body.outlineItem.title,
      subtitle: contentResult.subtitle,
      content: contentResult.content,
      bullets: contentResult.bullets,
      notes: contentResult.notes,
      imageCaption: contentResult.imageCaption,

      generatedBy: "ai",
      lastEditedAt: new Date().toISOString(),
      aiPromptUsed: generateSlideContentPrompt.substring(0, 200)
    };

    const response: GenerateSlideContentResponse = {
      slide
    };

    return apiOk(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate slide content.";
    return apiError(message, 500, "SLIDE_GENERATION_FAILED");
  }
}
