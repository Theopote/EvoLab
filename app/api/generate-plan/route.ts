import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { createMockPlanVersions } from "@/lib/mock-api";
import { postProcessPlanVersions } from "@/lib/plan-postprocess";
import { generatePlanPrompt } from "@/lib/prompts/generatePlanPrompt";
import { GeneratePlanToolInputSchema } from "@/lib/schemas/plan-version-schema";
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
    const data = await requestAnthropicTool({
      system: generatePlanPrompt,
      input: body,
      toolName: "generate_plan",
      toolDescription: "Return generated EvoLab architectural plan versions as structured data.",
      schema: GeneratePlanToolInputSchema,
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
