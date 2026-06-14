import { NextResponse } from "next/server";
import { requestAnthropicTool, type AnthropicImageMediaType } from "@/lib/anthropic-tool";
import { createMockAnalyzedVersion } from "@/lib/mock-api";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { analyzePlanPrompt } from "@/lib/prompts/analyzePlanPrompt";
import { AnalyzePlanToolInputSchema } from "@/lib/schemas/plan-version-schema";
import type { PlanVersion } from "@/lib/project-types";

interface AnalyzePlanRequest {
  imageBase64?: string;
  fileName?: string;
}

interface AnalyzePlanResponse {
  version: PlanVersion;
  confidence: number;
  warnings: string[];
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const mediaTypesByExtension: Record<string, AnthropicImageMediaType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp"
};

function inferMediaType(fileName?: string): AnthropicImageMediaType | undefined {
  const extension = fileName?.split(".").pop()?.toLowerCase();
  return extension ? mediaTypesByExtension[extension] : undefined;
}

function normalizeImageInput(imageBase64?: string, fileName?: string) {
  if (!imageBase64) {
    return undefined;
  }

  const trimmed = imageBase64.trim();
  const dataUrlMatch = trimmed.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/i);
  const mediaType = (dataUrlMatch?.[1]?.toLowerCase() as AnthropicImageMediaType | undefined) ?? inferMediaType(fileName);
  const base64 = (dataUrlMatch?.[2] ?? trimmed).replace(/\s/g, "");

  if (!mediaType) {
    throw new Error("Unsupported or missing image type. Use PNG, JPEG, GIF, or WebP.");
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error("imageBase64 is not valid base64 image data.");
  }

  const byteLength = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);

  if (byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Uploaded image is too large. Limit plan recognition images to 8 MB.");
  }

  return { base64, mediaType, byteLength };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzePlanRequest;
  const fallback = createMockAnalyzedVersion();

  try {
    const image = normalizeImageInput(body.imageBase64, body.fileName);

    if (!image) {
      return NextResponse.json(
        { error: "imageBase64 is required for analyze-plan." },
        { status: 400 }
      );
    }

    const data = await requestAnthropicTool({
      system: analyzePlanPrompt,
      input: {
        fileName: body.fileName,
        image: {
          mediaType: image.mediaType,
          byteLength: image.byteLength
        }
      },
      images: [{ base64: image.base64, mediaType: image.mediaType }],
      toolName: "analyze_plan",
      toolDescription: "Return recognized EvoLab architectural plan data, confidence, and recognition warnings.",
      schema: AnalyzePlanToolInputSchema,
      maxTokens: 8192
    });

    if (!data.version?.rooms || !Array.isArray(data.warnings)) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json({
      ...data,
      version: postProcessPlanVersion(data.version)
    });
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warnings: [
        ...fallback.warnings,
        error instanceof Error ? error.message : "Failed to analyze plan."
      ]
    });
  }
}
