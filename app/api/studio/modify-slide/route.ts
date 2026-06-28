import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { apiError, apiOk } from "@/lib/server/api-response";
import {
  modifySlidePrompt,
  modifySlideContentTool
} from "@/lib/presentation-studio/prompts";
import {
  ModifySlideRequestSchema,
  type ModifySlideRequest,
  type ModifySlideResponse
} from "@/lib/presentation-studio/types";
import { z } from "zod";

const ModifySlideResultSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  notes: z.string().optional(),
  imageCaption: z.string().optional(),
  changes: z.array(z.string())
});

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = ModifySlideRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid modify slide request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data as ModifySlideRequest;

  try {
    // 构建AI输入
    const aiInput = {
      currentSlide: {
        title: body.currentSlide.title,
        subtitle: body.currentSlide.subtitle,
        content: body.currentSlide.content,
        bullets: body.currentSlide.bullets,
        notes: body.currentSlide.notes,
        type: body.currentSlide.type
      },
      userRequest: body.userRequest,
      mode: body.mode ?? "refine"
    };

    // 调用AI修改内容
    const result = await requestAnthropicTool({
      system: modifySlidePrompt,
      input: aiInput,
      toolName: modifySlideContentTool.name,
      toolDescription: modifySlideContentTool.description,
      schema: ModifySlideResultSchema,
      maxTokens: 2048,
      task: "presentation-modify"
    });

    // 更新幻灯片
    const updatedSlide = {
      ...body.currentSlide,
      title: result.title,
      subtitle: result.subtitle,
      content: result.content,
      bullets: result.bullets,
      notes: result.notes,
      imageCaption: result.imageCaption,
      status: "edited" as const,
      lastEditedAt: new Date().toISOString()
    };

    const response: ModifySlideResponse = {
      slide: updatedSlide,
      changes: result.changes
    };

    return apiOk(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to modify slide.";
    return apiError(message, 500, "SLIDE_MODIFICATION_FAILED");
  }
}
