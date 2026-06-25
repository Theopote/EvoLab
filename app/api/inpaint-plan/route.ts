import { NextResponse } from "next/server";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { normalizeImageInputs } from "@/lib/image-input";
import { commitLevelRoomsToVersion, resolveLevelRooms } from "@/lib/level-rooms";
import { createMockModifiedVersion } from "@/lib/mock-api";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { inpaintPlanPrompt } from "@/lib/prompts/inpaintPlanPrompt";
import { enforceRegionLock } from "@/lib/region-lock";
import { enforceOpeningConstraintsOnVersion } from "@/lib/opening-constraints";
import { ModifyPlanToolInputSchema } from "@/lib/schemas/plan-version-schema";
import { StructuralConstraintSetSchema } from "@/lib/schemas/structural-constraints-schema";
import {
  enrichUserRequestWithStructuralConstraints,
  validateStructuralConstraints,
  type StructuralConstraintSet
} from "@/lib/structural-constraints";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

interface InpaintPlanRequest {
  currentVersion?: PlanVersion;
  userRequest?: string;
  baseImage?: string;
  maskImage?: string;
  allowedRoomIds?: string[];
  levelId?: string;
  structuralConstraints?: StructuralConstraintSet;
}

function mergeInpaintResult(
  baseVersion: PlanVersion,
  aiVersion: PlanVersion,
  options: {
    allowedRoomIds: Set<string>;
    levelId?: string;
  }
) {
  if (options.levelId) {
    const level = baseVersion.levels.find((item) => item.id === options.levelId);

    if (!level) {
      return baseVersion;
    }

    const originalLevelRooms = resolveLevelRooms(level, baseVersion.standardFloorGroups);
    const allowedOnLevel = new Set(
      [...options.allowedRoomIds].filter((roomId) => originalLevelRooms.some((room) => room.id === roomId))
    );
    const aiLevelRooms = aiVersion.rooms.filter((room) => allowedOnLevel.has(room.id));
    const mergedLevelRooms = enforceRegionLock(originalLevelRooms, aiLevelRooms, allowedOnLevel);

    return commitLevelRoomsToVersion(baseVersion, options.levelId, mergedLevelRooms);
  }

  return {
    ...aiVersion,
    rooms: enforceRegionLock(baseVersion.rooms, aiVersion.rooms, options.allowedRoomIds)
  };
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
  const userRequest = enrichUserRequestWithStructuralConstraints(body.userRequest, structuralConstraints, {
    floorName: body.levelId
      ? body.currentVersion.levels.find((level) => level.id === body.levelId)?.name
      : undefined
  });
  const fallback = createMockModifiedVersion(body.currentVersion, userRequest);

  try {
    const images = normalizeImageInputs([
      body.baseImage ? { base64: body.baseImage, fileName: "plan-context.png" } : undefined,
      body.maskImage ? { base64: body.maskImage, fileName: "inpaint-mask.png" } : undefined
    ].filter(Boolean) as Array<{ base64: string; fileName: string }>);

    if (images.length < 2) {
      return NextResponse.json({ error: "baseImage and maskImage are required." }, { status: 400 });
    }

    const data = await requestAnthropicTool({
      system: inpaintPlanPrompt,
      input: {
        currentVersion: body.currentVersion,
        userRequest,
        structuralConstraints,
        levelId: body.levelId,
        hasBaseImage: true,
        hasMaskImage: true
      },
      images: images.map((image) => ({
        base64: image.base64,
        mediaType: image.mediaType
      })),
      toolName: "inpaint_plan",
      toolDescription: "Return a complete PlanVersion with localized edits inside the masked region.",
      schema: ModifyPlanToolInputSchema,
      maxTokens: 8192
    });

    if (!data.version?.rooms || !Array.isArray(data.findings)) {
      return NextResponse.json(fallback);
    }

    const allowedIds = new Set(body.allowedRoomIds ?? []);
    const aiVersion = normalizePlanVersion(data.version);
    const mergedVersion = mergeInpaintResult(body.currentVersion, aiVersion, {
      allowedRoomIds: allowedIds,
      levelId: body.levelId
    });
    const openingEnforced = enforceOpeningConstraintsOnVersion(mergedVersion);
    const processed = postProcessPlanVersion({
      ...openingEnforced.version,
      parentVersionId: data.version.parentVersionId ?? body.currentVersion.id,
      metadata: {
        ...openingEnforced.version.metadata,
        repairs: [...(openingEnforced.version.metadata?.repairs ?? []), ...openingEnforced.repairs]
      }
    });

    const structuralViolations = structuralConstraints
      ? validateStructuralConstraints(processed, body.levelId ?? body.currentVersion.levels[0]?.id ?? "level-01", structuralConstraints)
      : [];

    return NextResponse.json({
      ...data,
      version: processed,
      openingRepairs: openingEnforced.repairs,
      structuralViolations,
      warning:
        structuralViolations.length > 0
          ? `Inpaint applied, but structural constraints remain: ${structuralViolations.join(" ")}`
          : undefined
    });
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to inpaint plan."
    });
  }
}
