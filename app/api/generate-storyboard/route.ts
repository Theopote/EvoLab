import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { appendNarrativeSlide, buildPresentationDeck, toStoryboardRequest } from "@/lib/presentation/storyboard";
import { presentationNarrativePrompt } from "@/lib/prompts/presentationNarrativePrompt";
import { GenerateStoryboardToolInputSchema } from "@/lib/schemas/presentation-schema";
import type { DesignBrief, PlanVersion, ProjectData } from "@/lib/project-types";
import type { BuildableEnvelope, SiteContext, ZoningConstraints } from "@/lib/site-types";
import { computeBuildableEnvelope } from "@/lib/buildable-envelope";

interface GenerateStoryboardRequest {
  project?: ProjectData;
  version?: PlanVersion;
  brief?: DesignBrief;
  siteContext?: SiteContext;
  zoning?: ZoningConstraints;
  outline?: Array<[number, number]>;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GenerateStoryboardRequest;

  if (!body.project || !body.version) {
    return NextResponse.json({ error: "project and version are required." }, { status: 400 });
  }

  const envelope =
    body.zoning && body.outline && body.outline.length >= 3
      ? computeBuildableEnvelope(body.outline, body.zoning)
      : undefined;

  let deck = buildPresentationDeck({
    project: body.project,
    version: body.version,
    brief: body.brief,
    siteContext: body.siteContext,
    envelope: envelope?.valid ? envelope : undefined
  });

  try {
    const narrative = await requestAnthropicTool({
      system: presentationNarrativePrompt,
      input: toStoryboardRequest({
        project: body.project,
        version: body.version,
        brief: body.brief,
        siteContext: body.siteContext,
        envelope: envelope?.valid ? envelope : undefined
      }),
      toolName: "generate_storyboard_narrative",
      toolDescription: "Return a client-facing design narrative and story arc for an EvoLab presentation deck.",
      schema: GenerateStoryboardToolInputSchema,
      maxTokens: 4096,
      maxValidationRetries: 1
    });

    deck = appendNarrativeSlide(deck, narrative.narrative);
    return NextResponse.json({ deck, storyArc: narrative.storyArc });
  } catch (error) {
    return NextResponse.json({
      deck,
      fallback: true,
      warning: error instanceof Error ? error.message : "Narrative generation unavailable; deck exported without AI story."
    });
  }
}
