import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { generateRuleBasedMep } from "@/lib/mep-router";
import { createMockMep } from "@/lib/mock-api";
import { mepPrompt } from "@/lib/prompts/mepPrompt";
import { apiError, apiOk } from "@/lib/server/api-response";
import { GenerateMepToolInputSchema } from "@/lib/schemas/mep-schema";
import type { CopilotFinding, MepLayout, PlanVersion } from "@/lib/project-types";
import { z } from "zod";

const GenerateMepRequestSchema = z.object({
  version: z.object({}).passthrough() // PlanVersion schema
});

interface GenerateMepRequest {
  version?: PlanVersion;
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = GenerateMepRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid generate-mep request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data as GenerateMepRequest;

  if (!body.version) {
    return apiError("version is required for generate-mep.", 400, "INVALID_PAYLOAD");
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
      return apiOk(fallback);
    }

    const routed = generateRuleBasedMep(body.version, data.mep);

    return apiOk({
      mep: routed.mep,
      findings: [...data.findings, ...routed.findings]
    });
  } catch (error) {
    return apiOk({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to generate MEP layout."
    });
  }
}
