import { readApiResponse } from "@/lib/api-client";
import type { AnthropicImageMediaType } from "@/lib/anthropic-types";
import { cornersResultToQuad } from "@/lib/import-image-utils";
import type { PerspectiveQuad } from "@/lib/import-image-utils";
import type { SheetCornerDetectionResult } from "@/lib/schemas/sheet-corner-detection-schema";

export interface DetectSheetCornersClientResult {
  quad: PerspectiveQuad;
  confidence: number;
  warnings: string[];
  fallback?: boolean;
}

export async function detectSheetCornersClient(input: {
  imageBase64: string;
  mediaType: AnthropicImageMediaType;
  fileName?: string;
}): Promise<DetectSheetCornersClientResult> {
  const response = await fetch("/api/detect-sheet-corners", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  const data = await readApiResponse<SheetCornerDetectionResult & { fallback?: boolean }>(response);

  return {
    quad: cornersResultToQuad(data),
    confidence: data.confidence,
    warnings: data.warnings ?? [],
    fallback: data.fallback
  };
}
