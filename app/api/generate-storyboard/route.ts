import { applySlideCopy } from "@/lib/presentation/apply-slide-copy";
import { appendNarrativeSlide, buildPresentationDeck, toStoryboardRequest } from "@/lib/presentation/storyboard";
import { presentationNarrativePrompt } from "@/lib/prompts/presentationNarrativePrompt";
import { apiError, apiOk } from "@/lib/server/api-response";
import { GenerateStoryboardToolInputSchema } from "@/lib/schemas/presentation-schema";
import type { DesignBrief, PlanVersion, ProjectData } from "@/lib/project-types";
import type { BuildableEnvelope, EnvironmentSurrogate, SiteContext, ZoningConstraints } from "@/lib/site-types";
import { computeBuildableEnvelope } from "@/lib/buildable-envelope";
import { requestAnthropicTool } from "@/lib/anthropic-tool";

interface GenerateStoryboardRequest {
  project?: ProjectData;
  version?: PlanVersion;
  brief?: DesignBrief;
  siteContext?: SiteContext;
  zoning?: ZoningConstraints;
  outline?: Array<[number, number]>;
  environmentSurrogate?: EnvironmentSurrogate;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GenerateStoryboardRequest;

  if (!body.project || !body.version) {
    return apiError("project and version are required.", 400, "INVALID_PAYLOAD");
  }

  const envelope =
    body.zoning && body.outline && body.outline.length >= 3
      ? computeBuildableEnvelope(body.outline, body.zoning)
      : undefined;

  const deckInput = {
    project: body.project,
    version: body.version,
    brief: body.brief,
    siteContext: body.siteContext,
    envelope: envelope?.valid ? envelope : undefined,
    environmentSurrogate: body.environmentSurrogate,
    outline: body.outline
  };

  let deck = buildPresentationDeck(deckInput);

  try {
    const storyboard = await requestAnthropicTool({
      system: presentationNarrativePrompt,
      input: toStoryboardRequest(deckInput),
      toolName: "generate_storyboard_narrative",
      toolDescription:
        "Return story arc labels, per-slide presentation copy, and a closing design narrative for an EvoLab deck.",
      schema: GenerateStoryboardToolInputSchema,
      maxTokens: 6144,
      maxValidationRetries: 1
    });

    deck = applySlideCopy(deck, storyboard.slideCopy);
    deck = appendNarrativeSlide(deck, storyboard.narrative);
    deck = {
      ...deck,
      storyArc: storyboard.storyArc
    };

    return apiOk({ deck, storyArc: storyboard.storyArc });
  } catch (error) {
    return apiOk({
      deck,
      fallback: true,
      warning: error instanceof Error ? error.message : "Narrative generation unavailable; deck exported without AI story."
    });
  }
}
