import { requestAnthropicTool } from "@/lib/anthropic-tool";
import type { PlanVersionDraft } from "@/lib/architecture-model";
import {
  envelopeErrorSummary,
  resolveGeneratePlanConstraints,
  type GeneratePlanConstraints
} from "@/lib/generate-plan-constraints";
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
import { topologiesToPlanVersions, type TopologyLayoutOptions } from "@/lib/topology-geometry";
import type { PlanVersion } from "@/lib/project-types";

export interface GeneratePlanPipelineMeta {
  phases: {
    topology: boolean;
    geometry: boolean;
    refinement: boolean;
  };
  refinedCount: number;
  warnings: string[];
  envelopeApplied: boolean;
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

function topologyLayoutOptions(constraints: GeneratePlanConstraints): TopologyLayoutOptions {
  return {
    siteOutline: constraints.siteOutline,
    layoutOutline: constraints.layoutOutline
  };
}

function topologyInput(body: GeneratePlanRequest, constraints: GeneratePlanConstraints, correction?: unknown) {
  return {
    outline: constraints.siteOutline,
    layoutOutline: constraints.layoutOutline,
    brief: body.brief,
    projectType: body.projectType,
    floors: constraints.floors,
    buildableEnvelope: constraints.envelope,
    correction
  };
}

async function requestTopologyPlan(
  body: GeneratePlanRequest,
  constraints: GeneratePlanConstraints,
  correction?: unknown
) {
  return requestAnthropicTool({
    system: generatePlanTopologyPrompt,
    input: topologyInput(body, constraints, correction),
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
  constraints: GeneratePlanConstraints,
  validationIssues: PlanValidationIssue[],
  envelopeIssues: string[],
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
      buildableEnvelope: constraints.envelope,
      validationIssues: summarizeValidationIssues(validationIssues),
      envelopeIssues,
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
  return topologies
    .map((topology, index) => ({
      topology,
      version: versions[index]
    }))
    .filter((pair): pair is TopologyGeometryPair => Boolean(pair.version));
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
  constraints: GeneratePlanConstraints,
  warnings: string[]
): Promise<PlanVersion | null> {
  let current = pair.version;
  let issues = validatePlanVersion(current).issues;
  let envelopeIssues = constraints.envelope
    ? envelopeErrorSummary([current], constraints.envelope, constraints.floors).map((item) => item.message)
    : [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const refined = await requestGeometryRefinement(
        current,
        pair.topology,
        constraints,
        issues,
        envelopeIssues,
        attempt > 0
          ? {
              reason: "Previous refinement still failed spatial, schema, or zoning envelope validation.",
              errors: summarizeValidationIssues(issues.filter((issue) => issue.severity === "error")),
              envelopeIssues,
              instruction:
                "Keep every room inside buildableEnvelope.footprint. Apply smaller rectangular moves only."
            }
          : undefined
      );

      current = postProcessPlanVersion(refined.version);
      issues = validatePlanVersion(current).issues;
      envelopeIssues = constraints.envelope
        ? envelopeErrorSummary([current], constraints.envelope, constraints.floors).map((item) => item.message)
        : [];

      if (refined.refinementSummary) {
        warnings.push(`${current.label}: ${refined.refinementSummary}`);
      }

      const draftCheck = GeneratePlanToolInputSchema.safeParse({ versions: [toDraft(current)] });
      if (!draftCheck.success) {
        warnings.push(`${current.label}: refinement schema validation failed on attempt ${attempt + 1}.`);
        continue;
      }

      if (issues.every((issue) => issue.severity !== "error") && envelopeIssues.length === 0) {
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
  return hasOnlyWarnings && envelopeIssues.length === 0 ? current : null;
}

export async function runGeneratePlanPipeline(body: GeneratePlanRequest): Promise<GeneratePlanPipelineResult> {
  const warnings: string[] = [];
  const constraints = resolveGeneratePlanConstraints(body);
  const layoutOptions = topologyLayoutOptions(constraints);
  const meta: GeneratePlanPipelineMeta = {
    phases: { topology: false, geometry: false, refinement: false },
    refinedCount: 0,
    warnings,
    envelopeApplied: Boolean(constraints.envelope)
  };

  if (constraints.envelope) {
    warnings.push(
      `Zoning envelope active: setback footprint ${constraints.envelope.maxFloorAreaSqm} sqm, max height ${constraints.envelope.maxHeightMeters}m.`
    );
  }

  let topologyData = await requestTopologyPlan(body, constraints);
  meta.phases.topology = true;

  let versions = topologiesToPlanVersions(topologyData.versions, layoutOptions);
  meta.phases.geometry = true;

  let geometryErrors = versionErrorSummary(versions);
  let envelopeErrors = envelopeErrorSummary(versions, constraints.envelope, constraints.floors);

  if (geometryErrors.length > 0 || envelopeErrors.length > 0) {
    topologyData = await requestTopologyPlan(body, constraints, {
      reason: "Previous topology produced geometry outside spatial or zoning constraints.",
      errors: [...geometryErrors, ...envelopeErrors],
      instruction: constraints.envelope
        ? "Reduce target areas and room count to fit inside buildableEnvelope footprint and floor-area cap."
        : "Return corrected topology only. Prefer fewer rooms, connected corridors, and compact core/service adjacency."
    });
    versions = topologiesToPlanVersions(topologyData.versions, layoutOptions);
    geometryErrors = versionErrorSummary(versions);
    envelopeErrors = envelopeErrorSummary(versions, constraints.envelope, constraints.floors);
  }

  if (versions.length === 0) {
    return { versions: [], meta };
  }

  if (envelopeErrors.length > 0) {
    warnings.push(...envelopeErrors.map((error) => `${error.versionId}: ${error.message}`));
  }

  const pairs = pairTopologiesWithVersions(topologyData.versions, versions);
  const refinedVersions: PlanVersion[] = [];

  for (const pair of pairs) {
    const refined = await refineVersionPair(pair, constraints, warnings);
    if (refined) {
      refinedVersions.push(refined);
      meta.refinedCount += 1;
    } else {
      warnings.push(`${pair.version.label}: kept algorithmic geometry after refinement attempts failed.`);
      const fallbackIssues = validatePlanVersion(pair.version).issues;
      const fallbackEnvelopeIssues = envelopeErrorSummary([pair.version], constraints.envelope, constraints.floors);
      if (
        fallbackIssues.every((issue) => issue.severity !== "error") &&
        fallbackEnvelopeIssues.length === 0
      ) {
        refinedVersions.push(pair.version);
      }
    }
  }

  meta.phases.refinement = meta.refinedCount > 0;

  const candidates =
    refinedVersions.length > 0
      ? refinedVersions
      : versions.filter((version) => {
          const spatialErrors = versionErrorSummary([version]);
          const zoningErrors = envelopeErrorSummary([version], constraints.envelope, constraints.floors);
          return spatialErrors.length === 0 && zoningErrors.length === 0;
        });

  const finalValidation = validateFinalVersions(candidates);

  if (!finalValidation.valid) {
    warnings.push(finalValidation.warning ?? "Final Zod validation failed.");
    return { versions: [], meta };
  }

  return {
    versions: finalValidation.versions.map((version) => ({
      ...version,
      metadata: {
        ...version.metadata,
        zoningApplied: Boolean(constraints.envelope),
        envelopeCompliant: true,
        pipelinePhases: meta.phases
      }
    })),
    meta
  };
}
