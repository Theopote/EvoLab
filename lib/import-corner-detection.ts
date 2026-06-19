import { requestAnthropicTool, type AnthropicImageMediaType } from "@/lib/anthropic-tool";
import { detectSheetCornersPrompt } from "@/lib/prompts/detectSheetCornersPrompt";
import {
  SheetCornerDetectionToolInputSchema,
  type SheetCornerDetectionResult
} from "@/lib/schemas/sheet-corner-detection-schema";
import { clampPerspectiveQuad, type PerspectiveQuad } from "@/lib/import-image-utils";

export function cornersResultToQuad(result: SheetCornerDetectionResult): PerspectiveQuad {
  return clampPerspectiveQuad([
    result.corners.topLeft,
    result.corners.topRight,
    result.corners.bottomRight,
    result.corners.bottomLeft
  ]);
}

export function createMockSheetCornerDetection(): SheetCornerDetectionResult {
  return {
    corners: {
      topLeft: [0.1, 0.12],
      topRight: [0.9, 0.1],
      bottomRight: [0.92, 0.88],
      bottomLeft: [0.08, 0.9]
    },
    confidence: 0.42,
    warnings: ["Mock corner detection returned a demo quadrilateral. Configure ANTHROPIC_API_KEY for vision-based detection."]
  };
}

export async function detectSheetCorners(options: {
  imageBase64: string;
  mediaType: AnthropicImageMediaType;
  fileName?: string;
}): Promise<SheetCornerDetectionResult> {
  const result = await requestAnthropicTool({
    system: detectSheetCornersPrompt,
    input: {
      fileName: options.fileName,
      task: "Detect the four outer corners of the architectural drawing sheet."
    },
    images: [{ base64: options.imageBase64, mediaType: options.mediaType }],
    toolName: "detect_sheet_corners",
    toolDescription:
      "Return normalized topLeft, topRight, bottomRight, and bottomLeft corners of the drawing sheet in the uploaded image.",
    schema: SheetCornerDetectionToolInputSchema,
    maxTokens: 1024
  });

  return result;
}
