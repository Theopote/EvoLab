import { NextResponse } from "next/server";
import { requestAnthropicJson } from "@/lib/anthropic-json";
import { createMockMep } from "@/lib/mock-api";
import { mepPrompt } from "@/lib/prompts/mepPrompt";
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
    const data = await requestAnthropicJson<GenerateMepResponse>({
      system: mepPrompt,
      input: body,
      maxTokens: 4096
    });

    if (!data.mep?.routes || !Array.isArray(data.findings)) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to generate MEP layout."
    });
  }
}
