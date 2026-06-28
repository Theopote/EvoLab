import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { apiError, apiOk } from "@/lib/server/api-response";
import {
  generateOutlinePrompt,
  generateOutlineTool
} from "@/lib/presentation-studio/prompts";
import {
  GenerateOutlineRequestSchema,
  PresentationOutlineSchema,
  type GenerateOutlineRequest,
  type GenerateOutlineResponse
} from "@/lib/presentation-studio/types";

function generateSlideId(index: number): string {
  return `slide_${Date.now()}_${index}`;
}

function generateSectionId(index: number): string {
  return `section_${Date.now()}_${index}`;
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = GenerateOutlineRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid generate outline request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data as GenerateOutlineRequest;

  try {
    // 构建AI输入
    const aiInput = {
      topic: body.topic,
      purpose: body.purpose,
      targetAudience: body.targetAudience,
      slideCount: body.slideCount ?? 12,
      keyPoints: body.keyPoints ?? []
    };

    // 调用AI生成大纲
    const result = await requestAnthropicTool({
      system: generateOutlinePrompt,
      input: aiInput,
      toolName: generateOutlineTool.name,
      toolDescription: generateOutlineTool.description,
      schema: PresentationOutlineSchema,
      maxTokens: 4096,
      task: "presentation-outline"
    });

    // 确保ID的唯一性
    const outline = {
      ...result,
      sections: result.sections.map((section, sectionIdx) => ({
        ...section,
        id: generateSectionId(sectionIdx),
        slides: section.slides.map((slide, slideIdx) => ({
          ...slide,
          id: generateSlideId(sectionIdx * 100 + slideIdx)
        }))
      }))
    };

    const response: GenerateOutlineResponse = {
      outline,
      suggestions: [
        "大纲已生成，您可以调整章节顺序或修改幻灯片标题",
        "确认大纲后，可以选择批量生成所有内容，或逐页生成",
        "也可以手动创建幻灯片"
      ]
    };

    return apiOk(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate outline.";
    return apiError(message, 500, "OUTLINE_GENERATION_FAILED");
  }
}
