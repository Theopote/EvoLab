import { apiError, apiOk } from "@/lib/server/api-response";
import {
  BatchGenerateSlidesRequestSchema,
  type BatchGenerateSlidesRequest,
  type BatchGenerateSlidesResponse
} from "@/lib/presentation-studio/types";

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = BatchGenerateSlidesRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid batch generate request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data as BatchGenerateSlidesRequest;

  try {
    // 批量生成每张幻灯片
    const slides = [];
    const errors = [];

    for (const slideId of body.slideIds) {
      try {
        // 调用单页生成API
        const response = await fetch(`${request.url.replace('/batch-generate', '/generate-slide')}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            presentationId: body.presentationId,
            slideId,
            tone: body.options?.tone,
            includeImage: body.options?.includeImages
          })
        });

        if (response.ok) {
          const data = await response.json();
          slides.push(data.slide);
        } else {
          errors.push({ slideId, error: "Generation failed" });
        }
      } catch (error) {
        errors.push({
          slideId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    const response: BatchGenerateSlidesResponse = {
      slides,
      errors: errors.length > 0 ? errors : undefined
    };

    return apiOk(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to batch generate slides.";
    return apiError(message, 500, "BATCH_GENERATION_FAILED");
  }
}
