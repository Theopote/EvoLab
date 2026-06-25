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

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `detect-sheet-corners failed with ${response.status}`);
  }

  const data = (await response.json()) as SheetCornerDetectionResult & { fallback?: boolean };

  return {
    quad: cornersResultToQuad(data),
    confidence: data.confidence,
    warnings: data.warnings ?? [],
    fallback: data.fallback
  };
}
