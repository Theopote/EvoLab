import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { normalizeImageInputs } from "@/lib/image-input";
import { createMockModifiedVersion } from "@/lib/mock-api";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { inpaintPlanPrompt } from "@/lib/prompts/inpaintPlanPrompt";
import { enforceRegionLock } from "@/lib/region-lock";
import { ModifyPlanToolInputSchema } from "@/lib/schemas/plan-version-schema";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

interface InpaintPlanRequest {
  currentVersion?: PlanVersion;
  userRequest?: string;
  baseImage?: string;
  maskImage?: string;
  allowedRoomIds?: string[];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as InpaintPlanRequest;

  if (!body.currentVersion) {
    return NextResponse.json({ error: "currentVersion is required for inpaint-plan." }, { status: 400 });
  }

  if (!body.userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest is required for inpaint-plan." }, { status: 400 });
  }

  const fallback = createMockModifiedVersion(body.currentVersion, body.userRequest);

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
        userRequest: body.userRequest,
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
    const lockedRooms =
      allowedIds.size > 0
        ? enforceRegionLock(body.currentVersion.rooms, data.version.rooms, allowedIds)
        : data.version.rooms;

    return NextResponse.json({
      ...data,
      version: postProcessPlanVersion({
        ...data.version,
        rooms: lockedRooms,
        parentVersionId: data.version.parentVersionId ?? body.currentVersion.id
      })
    });
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to inpaint plan."
    });
  }
}
