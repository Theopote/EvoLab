import { NextResponse } from "next/server";
import { requestAnthropicTool } from "@/lib/anthropic-tool";
import { createMockPlanVersions } from "@/lib/mock-api";
import { validatePlanVersion } from "@/lib/plan-validation";
import { generatePlanTopologyPrompt } from "@/lib/prompts/generatePlanTopologyPrompt";
import { GeneratePlanToolInputSchema, GeneratePlanTopologyToolInputSchema } from "@/lib/schemas/plan-version-schema";
import { topologiesToPlanVersions } from "@/lib/topology-geometry";
import type { PlanVersion, Point } from "@/lib/project-types";

interface GeneratePlanRequest {
  outline?: Point[];
  brief?: string;
  projectType?: string;
}

interface GeneratePlanResponse {
  versions: PlanVersion[];
}

function versionErrorSummary(versions: PlanVersion[]) {
  return versions.flatMap((version) =>
    validatePlanVersion(version).issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => ({
        versionId: version.id,
        issue: issue.id,
        message: issue.message,
        roomIds: issue.roomIds
      }))
  );
}

async function requestTopologyPlan(body: GeneratePlanRequest, correction?: unknown) {
  return requestAnthropicTool({
    system: generatePlanTopologyPrompt,
    input: {
      outline: body.outline,
      brief: body.brief,
      projectType: body.projectType,
      correction
    },
    toolName: "generate_plan_topology",
    toolDescription: "Return EvoLab architectural room topology, target areas, and adjacency graph without final geometry.",
    schema: GeneratePlanTopologyToolInputSchema,
    maxTokens: 8192,
    maxValidationRetries: 1
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as GeneratePlanRequest;
  const fallback: GeneratePlanResponse = {
    versions: createMockPlanVersions(body.outline, body.projectType)
  };

  try {
    let topologyData = await requestTopologyPlan(body);
    let versions = topologiesToPlanVersions(topologyData.versions, body.outline);
    let geometryErrors = versionErrorSummary(versions);

    if (geometryErrors.length > 0) {
      topologyData = await requestTopologyPlan(body, {
        reason: "The deterministic geometry generated from the previous topology failed spatial validation.",
        errors: geometryErrors,
        instruction: "Return corrected topology only. Prefer fewer rooms, connected corridors, and compact core/service adjacency."
      });
      versions = topologiesToPlanVersions(topologyData.versions, body.outline);
      geometryErrors = versionErrorSummary(versions);
    }

    if (versions.length === 0 || geometryErrors.length > 0) {
      return NextResponse.json(fallback);
    }

    const parsed = GeneratePlanToolInputSchema.safeParse({ versions });

    if (!parsed.success) {
      return NextResponse.json({
        ...fallback,
        fallback: true,
        warning: parsed.error.message
      });
    }

    return NextResponse.json({
      versions
    });
  } catch (error) {
    return NextResponse.json({
      ...fallback,
      fallback: true,
      warning: error instanceof Error ? error.message : "Failed to generate plan."
    });
  }
}
