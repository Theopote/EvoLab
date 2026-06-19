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
import { StructuralConstraintSetSchema } from "@/lib/schemas/structural-constraints-schema";
import {
  enrichUserRequestWithStructuralConstraints,
  validateStructuralConstraints,
  type StructuralConstraintSet
} from "@/lib/structural-constraints";
import type { CopilotFinding, PlanVersion } from "@/lib/project-types";

interface ReshapeBoundaryRequest {
  currentVersion?: PlanVersion;
  span?: BoundarySpanSelection;
  userRequest?: string;
  openingPolicy?: "preserve" | "remove";
  levelId?: string;
  structuralConstraints?: StructuralConstraintSet;
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

  const constraintResult = body.structuralConstraints
    ? StructuralConstraintSetSchema.safeParse(body.structuralConstraints)
    : undefined;

  if (body.structuralConstraints && !constraintResult?.success) {
    return NextResponse.json({ error: "Invalid structuralConstraints payload." }, { status: 400 });
  }

  const structuralConstraints = constraintResult?.success ? constraintResult.data : undefined;
  const levelId = body.levelId ?? body.currentVersion.levels[0]?.id;
  const userRequest = enrichUserRequestWithStructuralConstraints(body.userRequest, structuralConstraints, {
    floorName: levelId
      ? body.currentVersion.levels.find((level) => level.id === levelId)?.name
      : undefined
  });

  const span = spanResult.data;
  let points = mockReshapePoints(span, userRequest);
  let warning: string | undefined;
  let findings: CopilotFinding[] = [];

  if (hasAnthropicKey()) {
    try {
      const data = await requestAnthropicTool({
        system: reshapeBoundaryPrompt,
        input: {
          span,
          userRequest,
          structuralConstraints
        },
        toolName: "reshape_boundary",
        toolDescription: "Return replacement boundary points for the selected span.",
        schema: ReshapeBoundaryToolInputSchema
      });

      points = data.points;
      findings = data.findings ?? [];
    } catch (error) {
      warning = error instanceof Error ? error.message : "reshape-boundary fell back to local arc approximation.";
      points = mockReshapePoints(span, userRequest);
    }
  } else {
    warning = "ANTHROPIC_API_KEY is not configured. Using local arc approximation.";
  }

  try {
    const preview = buildReshapedPreviewVersion(body.currentVersion, span, points, {
      openingPolicy: body.openingPolicy,
      levelId
    });

    const structuralViolations = structuralConstraints
      ? validateStructuralConstraints(preview.version, levelId ?? "level-01", structuralConstraints)
      : [];

    if (structuralViolations.length > 0) {
      warning = [warning, `Structural constraints remain: ${structuralViolations.join(" ")}`]
        .filter(Boolean)
        .join(" ");
    }

    return NextResponse.json({
      points,
      findings,
      warning,
      structuralViolations,
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
