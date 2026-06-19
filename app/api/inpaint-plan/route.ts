import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { normalizeImageInputs } from "@/lib/image-input";
import { createMockInpaintProposal } from "@/lib/mock-api";
import { buildPreviewVersion } from "@/lib/plan-change-engine";
import { proposeInpaintChangesPrompt } from "@/lib/prompts/proposeInpaintChangesPrompt";
import { ProposePlanChangesToolInputSchema } from "@/lib/schemas/plan-change-proposal-schema";
import { StructuralConstraintSetSchema } from "@/lib/schemas/structural-constraints-schema";
import {
  enrichUserRequestWithStructuralConstraints,
  validateStructuralConstraints,
  type StructuralConstraintSet
} from "@/lib/structural-constraints";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";
import type { PlanVersion } from "@/lib/project-types";

export type { ModifyPlanResponse as InpaintPlanResponse } from "@/lib/copilot-modify-types";

interface InpaintPlanRequest {
  currentVersion?: PlanVersion;
  userRequest?: string;
  baseImage?: string;
  maskImage?: string;
  allowedRoomIds?: string[];
  lockedElementIds?: string[];
  levelId?: string;
  structuralConstraints?: StructuralConstraintSet;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as InpaintPlanRequest;

  if (!body.currentVersion) {
    return NextResponse.json({ error: "currentVersion is required for inpaint-plan." }, { status: 400 });
  }

  if (!body.userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest is required for inpaint-plan." }, { status: 400 });
  }

  const constraintResult = body.structuralConstraints
    ? StructuralConstraintSetSchema.safeParse(body.structuralConstraints)
    : undefined;

  if (body.structuralConstraints && !constraintResult?.success) {
    return NextResponse.json({ error: "Invalid structuralConstraints payload." }, { status: 400 });
  }

  const structuralConstraints = constraintResult?.success ? constraintResult.data : undefined;
  const allowedRoomIds =
    body.allowedRoomIds?.length ? body.allowedRoomIds : body.currentVersion.rooms.map((room) => room.id);
  const userRequest = enrichUserRequestWithStructuralConstraints(body.userRequest, structuralConstraints, {
    floorName: body.levelId
      ? body.currentVersion.levels.find((level) => level.id === body.levelId)?.name
      : undefined
  });
  const fallback = createMockInpaintProposal(body.currentVersion, userRequest, allowedRoomIds);

  try {
    const images = normalizeImageInputs(
      [
        body.baseImage ? { base64: body.baseImage, fileName: "plan-context.png" } : undefined,
        body.maskImage ? { base64: body.maskImage, fileName: "inpaint-mask.png" } : undefined
      ].filter(Boolean) as Array<{ base64: string; fileName: string }>
    );

    if (images.length < 2) {
      return NextResponse.json({ error: "baseImage and maskImage are required." }, { status: 400 });
    }

    const proposalData = await requestAnthropicTool({
      system: proposeInpaintChangesPrompt,
      input: {
        currentVersion: body.currentVersion,
        userRequest,
        allowedRoomIds,
        lockedElementIds: body.lockedElementIds ?? [],
        structuralConstraints,
        levelId: body.levelId,
        hasBaseImage: true,
        hasMaskImage: true
      },
      images: images.map((image) => ({
        base64: image.base64,
        mediaType: image.mediaType
      })),
      toolName: "propose_plan_changes",
      toolDescription:
        "Return a structured PlanChangeProposal with localized geometry operations inside the masked region.",
      schema: ProposePlanChangesToolInputSchema,
      maxTokens: 8192
    });

    if (proposalData.proposal?.operations?.length) {
      const version = buildPreviewVersion(body.currentVersion, proposalData.proposal, {
        allowedRoomIds,
        lockedElementIds: body.lockedElementIds
      });

      const structuralViolations = structuralConstraints
        ? validateStructuralConstraints(
            version,
            body.levelId ?? body.currentVersion.levels[0]?.id ?? "level-01",
            structuralConstraints
          )
        : [];

      return NextResponse.json({
        mode: "proposal",
        proposal: proposalData.proposal,
        version,
        findings: proposalData.findings ?? [],
        structuralViolations,
        warning:
          structuralViolations.length > 0
            ? `Proposal preview applied, but structural constraints remain: ${structuralViolations.join(" ")}`
            : undefined
      } satisfies ModifyPlanResponse);
    }
  } catch {
    // Fall through to deterministic mock proposal.
  }

  return NextResponse.json({
    ...fallback,
    fallback: true
  } satisfies ModifyPlanResponse);
}
