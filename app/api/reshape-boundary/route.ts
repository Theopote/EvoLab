import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { hasAnthropicKey } from "@/lib/anthropic-json";
import type { BoundarySpanSelection } from "@/lib/boundary-span-select";
import { buildReshapedPreviewVersion, mockReshapePoints } from "@/lib/local-form-edit";
import { reshapeBoundaryPrompt } from "@/lib/prompts/reshapeBoundaryPrompt";
import {
  BoundarySpanSelectionSchema,
  ReshapeBoundaryToolInputSchema
} from "@/lib/schemas/local-form-edit-schema";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

interface ReshapeBoundaryRequest {
  currentVersion?: PlanVersion;
  span?: BoundarySpanSelection;
  userRequest?: string;
  openingPolicy?: "preserve" | "remove";
  levelId?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ReshapeBoundaryRequest;

  if (!body.currentVersion) {
    return NextResponse.json({ error: "currentVersion is required." }, { status: 400 });
  }

  const spanResult = BoundarySpanSelectionSchema.safeParse(body.span);

  if (!spanResult.success) {
    return NextResponse.json({ error: "A valid boundary span selection is required." }, { status: 400 });
  }

  if (!body.userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest is required." }, { status: 400 });
  }

  const span = spanResult.data;
  let points = mockReshapePoints(span, body.userRequest);
  let warning: string | undefined;
  let findings: CopilotFinding[] = [];

  if (hasAnthropicKey()) {
    try {
      const data = await requestAnthropicTool({
        system: reshapeBoundaryPrompt,
        input: {
          span,
          userRequest: body.userRequest
        },
        toolName: "reshape_boundary",
        toolDescription: "Return replacement boundary points for the selected span.",
        schema: ReshapeBoundaryToolInputSchema
      });

      points = data.points;
      findings = data.findings ?? [];
    } catch (error) {
      warning = error instanceof Error ? error.message : "reshape-boundary fell back to local arc approximation.";
      points = mockReshapePoints(span, body.userRequest);
    }
  } else {
    warning = "ANTHROPIC_API_KEY is not configured. Using local arc approximation.";
  }

  try {
    const preview = buildReshapedPreviewVersion(body.currentVersion, span, points, {
      openingPolicy: body.openingPolicy,
      levelId: body.levelId
    });

    return NextResponse.json({
      points,
      findings,
      warning,
      affectedOpeningIds: preview.affectedOpeningIds,
      openingRepairs: preview.openingRepairs,
      version: preview.version
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reshape boundary."
      },
      { status: 400 }
    );
  }
}
