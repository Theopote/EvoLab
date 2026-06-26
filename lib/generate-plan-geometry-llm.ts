import { requestAnthropicTool } from "@/lib/anthropic-tool";
import type { GeneratePlanConstraints } from "@/lib/generate-plan-constraints";
import type { PostProcessOptions } from "@/lib/plan-postprocess";
import { DEFAULT_PROMPT_REFS, resolvePrompt } from "@/lib/prompts/registry";
import type { GeneratePlanRequest } from "@/lib/schemas/generate-plan-request-schema";
import {
  GeneratePlanGeometryToolInputSchema,
  type PlanTopologyVersion
} from "@/lib/schemas/plan-version-schema";
import { resolveTopologyLayout } from "@/lib/topology-geometry";
import type { PlanVersion } from "@/lib/project-types";
import {
  buildGeometryPhaseInput,
  finalizePlanGeometryVersion
} from "@/lib/generate-plan-geometry";
import "server-only";

export async function requestPlanGeometryFromTopology(
  topology: PlanTopologyVersion,
  constraints: GeneratePlanConstraints,
  body: GeneratePlanRequest,
  options?: { correction?: unknown }
) {
  const geometryInput = buildGeometryPhaseInput(topology, constraints, body, options?.correction);

  return requestAnthropicTool({
    system: resolvePrompt(DEFAULT_PROMPT_REFS.generatePlanGeometry, { projectType: body.projectType }),
    input: geometryInput,
    toolName: "generate_plan_geometry",
    toolDescription:
      "Convert a locked room topology graph into metric floor-plan geometry inside the site outline.",
    schema: GeneratePlanGeometryToolInputSchema,
    maxTokens: 8192,
    maxValidationRetries: 2,
    task: "generate-plan-geometry",
    route: "/api/generate-plan",
    promptRef: DEFAULT_PROMPT_REFS.generatePlanGeometry,
    cacheInput: geometryInput
  });
}

export async function generatePlanVersionsFromTopologies(
  topologies: PlanTopologyVersion[],
  constraints: GeneratePlanConstraints,
  body: GeneratePlanRequest,
  scoringOptions: PostProcessOptions,
  warnings: string[],
  options?: {
    correction?: unknown;
  }
): Promise<PlanVersion[]> {
  const { localizedSite } = resolveTopologyLayout({
    siteOutline: constraints.siteOutline,
    layoutOutline: constraints.layoutOutline
  });
  const versions: PlanVersion[] = [];

  for (const topology of topologies) {
    try {
      const response = await requestPlanGeometryFromTopology(topology, constraints, body, {
        correction: options?.correction
      });
      versions.push(finalizePlanGeometryVersion(response.version, topology, localizedSite, scoringOptions));
    } catch (error) {
      warnings.push(
        `${topology.label}: LLM geometry generation failed (${error instanceof Error ? error.message : "unknown error"}).`
      );
    }
  }

  return versions;
}
