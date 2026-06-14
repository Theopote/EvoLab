import { NextResponse } from "next/server";
import { requestAnthropicJson } from "@/lib/anthropic-json";
import { createMockPlanVersions } from "@/lib/mock-api";
import { postProcessPlanVersions } from "@/lib/plan-postprocess";
import { generatePlanPrompt } from "@/lib/prompts/generatePlanPrompt";
import type { PlanVersion, Point } from "@/lib/project-types";

interface GeneratePlanRequest {
  outline?: Point[];
  brief?: string;
  projectType?: string;
}

interface GeneratePlanResponse {
  versions: PlanVersion[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GeneratePlanRequest;
  const fallback: GeneratePlanResponse = {
    versions: createMockPlanVersions(body.outline, body.projectType)
  };

  try {
    const data = await requestAnthropicJson<GeneratePlanResponse>({
      system: generatePlanPrompt,
      input: body,
      maxTokens: 8192
    });

    if (!Array.isArray(data.versions) || data.versions.length === 0) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json({
      ...data,
      versions: postProcessPlanVersions(data.versions)
    });
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to generate plan."
    });
  }
}
