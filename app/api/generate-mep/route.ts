import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { generateRuleBasedMep } from "@/lib/mep-router";
import { createMockMep } from "@/lib/mock-api";
import { mepPrompt } from "@/lib/prompts/mepPrompt";
import { GenerateMepToolInputSchema } from "@/lib/schemas/mep-schema";
import type { CopilotFinding, MepLayout, PlanVersion } from "@/lib/project-types";

interface GenerateMepRequest {
  version?: PlanVersion;
}

interface GenerateMepResponse {
  mep: MepLayout;
  findings: CopilotFinding[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GenerateMepRequest;

  if (!body.version) {
    return NextResponse.json({ error: "version is required for generate-mep." }, { status: 400 });
  }

  const fallback = createMockMep(body.version);

  try {
    const data = await requestAnthropicTool({
      system: mepPrompt,
      input: body,
      toolName: "generate_mep",
      toolDescription: "Return a conceptual EvoLab MEP layout with shafts, system routes, and findings.",
      schema: GenerateMepToolInputSchema,
      maxTokens: 4096
    });

    if (!data.mep?.routes || !Array.isArray(data.findings)) {
      return NextResponse.json(fallback);
    }

    const routed = generateRuleBasedMep(body.version, data.mep);

    return NextResponse.json({
      mep: routed.mep,
      findings: [...data.findings, ...routed.findings]
    });
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to generate MEP layout."
    });
  }
}
