import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { normalizeImageInput } from "@/lib/image-input";
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
