import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { normalizeImageInputs } from "@/lib/image-input";
import { createMockModifiedVersion } from "@/lib/mock-api";
import { buildPreviewVersion } from "@/lib/plan-change-engine";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { modifyPlanPrompt } from "@/lib/prompts/modifyPlanPrompt";
import { proposePlanChangesPrompt } from "@/lib/prompts/proposePlanChangesPrompt";
import { ModifyPlanToolInputSchema } from "@/lib/schemas/plan-version-schema";
import { ProposePlanChangesToolInputSchema } from "@/lib/schemas/plan-change-proposal-schema";
import type { PlanVersion } from "@/lib/project-types";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";

export type { ModifyPlanResponse } from "@/lib/copilot-modify-types";

interface ModifyPlanRequest {
  currentVersion?: PlanVersion;
  userRequest?: string;
  lockedElementIds?: string[];
  referenceImages?: Array<{ base64: string; mediaType?: string; fileName?: string }>;
}

function legacyVersionFromTool(
  version: PlanVersion,
  currentVersion: PlanVersion
): PlanVersion {
  return postProcessPlanVersion({
    ...version,
    parentVersionId: version.parentVersionId ?? currentVersion.id
  });
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
  const referenceImages = normalizeImageInputs(body.referenceImages);

  try {
    const proposalData = await requestAnthropicTool({
      system: proposePlanChangesPrompt,
      input: {
        currentVersion: body.currentVersion,
        userRequest: body.userRequest,
        lockedElementIds: body.lockedElementIds ?? [],
        referenceImageCount: referenceImages.length,
        referenceImageNames: referenceImages.map((image) => image.fileName).filter(Boolean)
      },
      images: referenceImages.map((image) => ({
        base64: image.base64,
        mediaType: image.mediaType
      })),
      toolName: "propose_plan_changes",
      toolDescription:
        "Return a structured PlanChangeProposal with intent, constraints, and geometry operations.",
      schema: ProposePlanChangesToolInputSchema,
      maxTokens: 4096
    });

    if (proposalData.proposal?.operations?.length) {
      const version = buildPreviewVersion(body.currentVersion, proposalData.proposal, {
        lockedElementIds: body.lockedElementIds
      });

      return NextResponse.json({
        mode: "proposal",
        proposal: proposalData.proposal,
        version,
        findings: proposalData.findings ?? []
      } satisfies ModifyPlanResponse);
    }
  } catch {
    // Fall through to legacy full-version modify path.
  }

  try {
    const data = await requestAnthropicTool({
      system: modifyPlanPrompt,
      input: {
        currentVersion: body.currentVersion,
        userRequest: body.userRequest,
        lockedElementIds: body.lockedElementIds ?? [],
        referenceImageCount: referenceImages.length,
        referenceImageNames: referenceImages.map((image) => image.fileName).filter(Boolean)
      },
      images: referenceImages.map((image) => ({
        base64: image.base64,
        mediaType: image.mediaType
      })),
      toolName: "modify_plan",
      toolDescription: "Return a complete modified EvoLab plan version and concrete Copilot findings.",
      schema: ModifyPlanToolInputSchema,
      maxTokens: 8192
    });

    if (!data.version?.rooms || !Array.isArray(data.findings)) {
      return NextResponse.json(fallback);
    }

    return NextResponse.json({
      mode: "legacy",
      version: legacyVersionFromTool(data.version as PlanVersion, body.currentVersion),
      findings: data.findings
    } satisfies ModifyPlanResponse);
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to modify plan."
    } satisfies ModifyPlanResponse);
  }
}
