import { requestAnthropicTool } from "@/lib/anthropic-tool";
import type { PlanVersionDraft } from "@/lib/architecture-model";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { validatePlanVersion, type PlanValidationIssue } from "@/lib/plan-validation";
import { generatePlanTopologyPrompt } from "@/lib/prompts/generatePlanTopologyPrompt";
import { refinePlanGeometryPrompt } from "@/lib/prompts/refinePlanGeometryPrompt";
import type { GeneratePlanRequest } from "@/lib/schemas/generate-plan-request-schema";
import {
  GeneratePlanToolInputSchema,
  GeneratePlanTopologyToolInputSchema,
  RefinePlanGeometryToolInputSchema,
  type PlanTopologyVersion
} from "@/lib/schemas/plan-version-schema";
import { topologiesToPlanVersions } from "@/lib/topology-geometry";
import type { PlanVersion } from "@/lib/project-types";

export interface GeneratePlanPipelineMeta {
  phases: {
    topology: boolean;
    geometry: boolean;
    refinement: boolean;
  };
  refinedCount: number;
  warnings: string[];
}

export interface GeneratePlanPipelineResult {
  versions: PlanVersion[];
  meta: GeneratePlanPipelineMeta;
}

interface TopologyGeometryPair {
  topology: PlanTopologyVersion;
  version: PlanVersion;
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

function toDraft(version: PlanVersion): PlanVersionDraft {
  const { levels, building, mep, ...draft } = version;
  return draft;
}

function summarizeValidationIssues(issues: PlanValidationIssue[]) {
  return issues.map((issue) => ({
    id: issue.id,
    severity: issue.severity,
    message: issue.message,
    roomIds: issue.roomIds
  }));
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
    toolDescription:
      "Return EvoLab architectural room topology, target areas, and adjacency graph without final geometry.",
    schema: GeneratePlanTopologyToolInputSchema,
    maxTokens: 8192,
    maxValidationRetries: 2
  });
}

async function requestGeometryRefinement(
  version: PlanVersion,
  topology: PlanTopologyVersion,
  validationIssues: PlanValidationIssue[],
  correction?: unknown
) {
  return requestAnthropicTool({
    system: refinePlanGeometryPrompt,
    input: {
      version: toDraft(version),
      topology: {
        strategy: topology.strategy,
        rooms: topology.rooms.map((room) => ({
          id: room.id,
          name: room.name,
          type: room.type
        })),
        edges: topology.edges
      },
      validationIssues: summarizeValidationIssues(validationIssues),
      correction
    },
    toolName: "refine_plan_geometry",
    toolDescription:
      "Micro-adjust algorithmically generated room polygons to fix spatial validation issues while preserving room program.",
    schema: RefinePlanGeometryToolInputSchema,
    maxTokens: 8192,
    maxValidationRetries: 2
  });
}

function pairTopologiesWithVersions(
  topologies: PlanTopologyVersion[],
  versions: PlanVersion[]
): TopologyGeometryPair[] {
  return topologies.map((topology, index) => ({
    topology,
    version: versions[index]
  })).filter((pair): pair is TopologyGeometryPair => Boolean(pair.version));
}

function validateFinalVersions(versions: PlanVersion[]) {
  const parsed = GeneratePlanToolInputSchema.safeParse({
    versions: versions.map((version) => toDraft(version))
  });

  if (!parsed.success) {
    return {
      valid: false as const,
      versions: [] as PlanVersion[],
      warning: parsed.error.message
    };
  }

  return {
    valid: true as const,
    versions,
    warning: undefined
  };
}

async function refineVersionPair(
  pair: TopologyGeometryPair,
  warnings: string[]
): Promise<PlanVersion | null> {
  let current = pair.version;
  let issues = validatePlanVersion(current).issues;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const refined = await requestGeometryRefinement(
        current,
        pair.topology,
        issues,
        attempt > 0
          ? {
              reason: "Previous refinement still failed spatial or schema validation.",
              errors: summarizeValidationIssues(issues.filter((issue) => issue.severity === "error")),
              instruction:
                "Apply smaller rectangular moves only. Ensure all polygon coordinates are finite and inside outline."
            }
          : undefined
      );

      current = postProcessPlanVersion(refined.version);
      issues = validatePlanVersion(current).issues;

      if (refined.refinementSummary) {
        warnings.push(`${current.label}: ${refined.refinementSummary}`);
      }

      const draftCheck = GeneratePlanToolInputSchema.safeParse({ versions: [toDraft(current)] });
      if (!draftCheck.success) {
        warnings.push(`${current.label}: refinement schema validation failed on attempt ${attempt + 1}.`);
        continue;
      }

      if (issues.every((issue) => issue.severity !== "error")) {
        return current;
      }
    } catch (error) {
      warnings.push(
        `${pair.version.label}: refinement failed (${error instanceof Error ? error.message : "unknown error"}).`
      );
      break;
    }
  }

  const hasOnlyWarnings = issues.every((issue) => issue.severity !== "error");
  return hasOnlyWarnings ? current : null;
}

export async function runGeneratePlanPipeline(body: GeneratePlanRequest): Promise<GeneratePlanPipelineResult> {
  const warnings: string[] = [];
  const meta: GeneratePlanPipelineMeta = {
    phases: { topology: false, geometry: false, refinement: false },
    refinedCount: 0,
    warnings
  };

  let topologyData = await requestTopologyPlan(body);
  meta.phases.topology = true;

  let versions = topologiesToPlanVersions(topologyData.versions, body.outline);
  meta.phases.geometry = true;

  let geometryErrors = versionErrorSummary(versions);

  if (geometryErrors.length > 0) {
    topologyData = await requestTopologyPlan(body, {
      reason: "The deterministic geometry generated from the previous topology failed spatial validation.",
      errors: geometryErrors,
      instruction:
        "Return corrected topology only. Prefer fewer rooms, connected corridors, and compact core/service adjacency."
    });
    versions = topologiesToPlanVersions(topologyData.versions, body.outline);
    geometryErrors = versionErrorSummary(versions);
  }

  if (versions.length === 0) {
    return { versions: [], meta };
  }

  const pairs = pairTopologiesWithVersions(topologyData.versions, versions);
  const refinedVersions: PlanVersion[] = [];

  for (const pair of pairs) {
    const refined = await refineVersionPair(pair, warnings);
    if (refined) {
      refinedVersions.push(refined);
      meta.refinedCount += 1;
    } else {
      warnings.push(`${pair.version.label}: kept algorithmic geometry after refinement attempts failed.`);
      const fallbackIssues = validatePlanVersion(pair.version).issues;
      if (fallbackIssues.every((issue) => issue.severity !== "error")) {
        refinedVersions.push(pair.version);
      }
    }
  }

  meta.phases.refinement = meta.refinedCount > 0;

  const candidates = refinedVersions.length > 0 ? refinedVersions : versions.filter((version) => versionErrorSummary([version]).length === 0);
  const finalValidation = validateFinalVersions(candidates);

  if (!finalValidation.valid) {
    warnings.push(finalValidation.warning ?? "Final Zod validation failed.");
    return { versions: [], meta };
  }

  return {
    versions: finalValidation.versions,
    meta
  };
}
