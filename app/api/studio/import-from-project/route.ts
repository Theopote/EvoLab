import { buildPresentationDeck } from "@/lib/presentation/storyboard";
import { apiError, apiOk } from "@/lib/server/api-response";
import {
  ImportFromProjectRequestSchema,
  type ImportFromProjectRequest,
  type ImportFromProjectResponse,
  type PresentationOutline,
  type StudioSlide
} from "@/lib/presentation-studio/types";
import type { PresentationSlide } from "@/lib/presentation/types";

/**
 * 将现有Presentation模块的幻灯片转换为Studio格式
 */
function convertToStudioSlide(
  slide: PresentationSlide,
  order: number
): StudioSlide {
  return {
    id: slide.id,
    order,
    type: mapSlideKindToContentType(slide.kind),
    status: "generated",

    title: slide.title,
    subtitle: slide.subtitle,
    bullets: slide.bullets,
    notes: undefined,

    generatedBy: "project",
    lastEditedAt: new Date().toISOString()
  };
}

function mapSlideKindToContentType(kind: string): StudioSlide["type"] {
  const mapping: Record<string, StudioSlide["type"]> = {
    cover: "title",
    site: "content",
    evolution: "timeline",
    topology: "data-viz",
    massing: "image-text",
    plan: "image-text",
    zones: "data-viz",
    flow: "process",
    facade: "image-text",
    systems: "data-viz",
    compare: "comparison",
    quantities: "data-viz",
    cost: "data-viz",
    narrative: "content"
  };

  return mapping[kind] ?? "content";
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = ImportFromProjectRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid import request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data as ImportFromProjectRequest;

  try {
    // TODO: 从数据库加载项目数据
    // 目前使用mock逻辑

    // 使用现有的buildPresentationDeck生成幻灯片
    const deck = buildPresentationDeck({
      project: {} as any, // TODO: 加载真实项目
      version: {} as any, // TODO: 加载真实版本
      siteContext: undefined,
      envelope: undefined
    });

    // 过滤用户选择的幻灯片
    const filteredSlides = body.includeSlides
      ? deck.slides.filter((slide) => body.includeSlides?.includes(slide.kind as any))
      : deck.slides;

    // 转换为Studio格式
    const studioSlides = filteredSlides.map((slide, index) =>
      convertToStudioSlide(slide, index)
    );

    const importedSlideIds = studioSlides.map((s) => s.id);

    // 构建大纲
    const outline: PresentationOutline = {
      title: deck.projectName,
      subtitle: `${deck.projectType} · ${deck.versionLabel}`,
      sections: [
        {
          id: `section_${Date.now()}`,
          title: "项目汇报",
          slideCount: studioSlides.length,
          slides: studioSlides.map((slide) => ({
            id: slide.id,
            title: slide.title ?? "未命名",
            type: slide.type,
            notes: undefined
          }))
        }
      ],
      totalSlides: studioSlides.length
    };

    // 根据mode决定返回新ID还是现有ID
    const presentationId =
      body.mode === "append" && body.targetPresentationId
        ? body.targetPresentationId
        : `pres_${Date.now()}`;

    const response: ImportFromProjectResponse = {
      presentationId,
      importedSlideIds,
      outline
    };

    return apiOk(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import from project.";
    return apiError(message, 500, "IMPORT_FAILED");
  }
}
