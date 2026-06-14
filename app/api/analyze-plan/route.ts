import { NextResponse } from "next/server";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { requestAnthropicJson } from "@/lib/anthropic-json";
import { createMockAnalyzedVersion } from "@/lib/mock-api";
import { analyzePlanPrompt } from "@/lib/prompts/analyzePlanPrompt";
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
    const data = await requestAnthropicJson<AnalyzePlanResponse>({
      system: analyzePlanPrompt,
      input: {
        fileName: body.fileName,
        imageBase64: body.imageBase64 ? "[base64 image omitted from logs]" : undefined
      },
      maxTokens: 8192
    });

    if (!data.version?.rooms || !Array.isArray(data.warnings)) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json({
      ...data,
      version: normalizePlanVersion(data.version)
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
