import { createMockSheetCornerDetection, detectSheetCorners } from "@/lib/import-corner-detection";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { AnthropicImageMediaType } from "@/lib/anthropic-tool";

interface DetectSheetCornersRequest {
  imageBase64?: string;
  mediaType?: AnthropicImageMediaType;
  fileName?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DetectSheetCornersRequest;

  if (!body.imageBase64?.trim()) {
    return apiError("imageBase64 is required.", 400, "INVALID_PAYLOAD");
  }

  const mediaType = body.mediaType ?? "image/jpeg";

  try {
    const result = await detectSheetCorners({
      imageBase64: body.imageBase64,
      mediaType,
      fileName: body.fileName
    });

    return apiOk(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to detect sheet corners.";
    const fallback = createMockSheetCornerDetection();

    return apiOk({
      ...fallback,
      fallback: true,
      warnings: [...fallback.warnings, message]
    });
  }
}
