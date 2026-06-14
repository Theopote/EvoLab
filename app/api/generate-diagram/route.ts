import { NextResponse } from "next/server";
import { requestAnthropicJson } from "@/lib/anthropic-json";
import { createMockDiagram } from "@/lib/mock-api";
import { diagramPrompt } from "@/lib/prompts/diagramPrompt";
import type { AnalysisLayerId, PlanVersion } from "@/lib/project-types";

interface GenerateDiagramRequest {
  version?: PlanVersion;
  layers?: AnalysisLayerId[];
}

interface GenerateDiagramResponse {
  svg?: string;
  overlays?: unknown;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GenerateDiagramRequest;
  const fallback = createMockDiagram(body.layers ?? ["function_zones"]);

  try {
    const data = await requestAnthropicJson<GenerateDiagramResponse>({
      system: diagramPrompt,
      input: body,
      maxTokens: 4096
    });

    if (!data.svg && !data.overlays) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to generate diagram."
    });
  }
}
