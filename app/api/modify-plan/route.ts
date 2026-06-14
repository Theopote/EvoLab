import { NextResponse } from "next/server";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { requestAnthropicJson } from "@/lib/anthropic-json";
import { createMockModifiedVersion } from "@/lib/mock-api";
import { modifyPlanPrompt } from "@/lib/prompts/modifyPlanPrompt";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

interface ModifyPlanRequest {
  currentVersion?: PlanVersion;
  userRequest?: string;
}

interface ModifyPlanResponse {
  version: PlanVersion;
  findings: CopilotFinding[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ModifyPlanRequest;

  if (!body.currentVersion) {
    return NextResponse.json(
      { error: "currentVersion is required for modify-plan." },
      { status: 400 }
    );
  }

  const fallback = createMockModifiedVersion(body.currentVersion, body.userRequest ?? "");

  try {
    const data = await requestAnthropicJson<ModifyPlanResponse>({
      system: modifyPlanPrompt,
      input: body,
      maxTokens: 8192
    });

    if (!data.version?.rooms || !Array.isArray(data.findings)) {
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
      warning: error instanceof Error ? error.message : "Failed to modify plan."
    });
  }
}
