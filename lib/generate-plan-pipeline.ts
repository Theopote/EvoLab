import { requestAnthropicTool } from "@/lib/anthropic-tool";
import type { PlanVersionDraft } from "@/lib/architecture-model";
import {
  envelopeErrorSummary,
  resolveGeneratePlanConstraints,
  type GeneratePlanConstraints
} from "@/lib/generate-plan-constraints";
import { postProcessPlanVersion, type PostProcessOptions } from "@/lib/plan-postprocess";
import { validatePlanVersion, type PlanValidationIssue } from "@/lib/plan-validation";
import { buildRefineGeometrySystemPrompt } from "@/lib/prompts/refinePlanGeometryPrompt";
import { buildGenerateTopologySystemPrompt } from "@/lib/prompts/generateTopologyPrompt";
import {
  buildGeometryPromptSupplement,
  buildTopologyPromptSupplement
} from "@/lib/prompts/typologySupplement";
import type { GeneratePlanRequest } from "@/lib/schemas/generate-plan-request-schema";
import {
  GeneratePlanToolInputSchema,
  GeneratePlanTopologyToolInputSchema,
  RefinePlanGeometryToolInputSchema,
  type PlanTopologyVersion
} from "@/lib/schemas/plan-version-schema";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import {
  applyStrategyLabel,
  buildPriorSchemeNote,
  SCHEME_STRATEGIES,
  strategyForIndex,
  type SchemeStrategy
} from "@/lib/scheme-strategies";
import { rescoreVersions } from "@/lib/rules/resolve-version-scoring";
import {
  programTopologyErrorSummary,
  programVersionErrorSummary,
  resolveProgramForGeneration,
  validateVersionAgainstProgram
} from "@/lib/program-validation";
import { topologiesToPlanVersions, type TopologyLayoutOptions } from "@/lib/topology-geometry";
import { topologyGraphFromTopology } from "@/lib/topology-graph";
import { resolveTypologyPack } from "@/lib/typology/resolve";
import type { PlanVersion } from "@/lib/project-types";

export interface GeneratePlanPipelineMeta {
  phases: {
    topology: boolean;
    geometry: boolean;
    refinement: boolean;
  };
  topologyCount: number;
  refinedCount: number;
  warnings: string[];
  envelopeApplied: boolean;
  programApplied: boolean;
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

function resolveOrientationDeg(body: GeneratePlanRequest) {
  const preference = body.designBrief?.orientationPreference?.toLowerCase() ?? "";
  if (preference.includes("south")) {
    return 180;
  }
  if (preference.includes("north")) {
    return 0;
  }
  if (preference.includes("east")) {
    return 90;
  }
  if (preference.includes("west")) {
    return 270;
  }
  return undefined;
}

function postProcessOptions(body: GeneratePlanRequest, program: ReturnType<typeof resolveProgramForGeneration>): PostProcessOptions {
  return {
    program,
    projectType: body.projectType,
    orientationDeg: resolveOrientationDeg(body)
  };
}

function topologyLayoutOptions(constraints: GeneratePlanConstraints, projectType?: string): TopologyLayoutOptions {
  const pack = resolveTypologyPack(projectType);
  return {
    siteOutline: constraints.siteOutline,
    layoutOutline: constraints.layoutOutline,
    wetRoomTypes: pack.topology.wetRoomTypes
  };
}

function topologyInput(
  body: GeneratePlanRequest,
  constraints: GeneratePlanConstraints,
  program: ReturnType<typeof resolveProgramForGeneration>,
  options?: {
    correction?: unknown;
    assignedStrategy?: SchemeStrategy;
    priorSchemeNote?: string;
    versionCount?: number;
  }
) {
  const pack = resolveTypologyPack(body.projectType);
  return {
    outline: constraints.siteOutline,
    layoutOutline: constraints.layoutOutline,
    brief: body.brief,
    designBrief: body.designBrief,
    program,
    projectType: body.projectType,
    floors: constraints.floors,
    buildableEnvelope: constraints.envelope,
    schemeStrategies: SCHEME_STRATEGIES,
    assignedStrategy: options?.assignedStrategy,
    priorSchemeNote: options?.priorSchemeNote,
    versionCount: options?.versionCount ?? 3,
    typologyPack: {
      id: pack.id,
      label: pack.label,
      roomTypes: pack.roomTypes,
      strategies: pack.topology.strategies,
      roomTemplates: pack.topology.roomTemplates,
      adjacencyRules: pack.adjacencyRules,
      wetRoomTypes: pack.topology.wetRoomTypes,
      guidance: buildTopologyPromptSupplement(body.projectType)
    },
    correction: options?.correction
  };
}

async function requestTopologyPlan(
  body: GeneratePlanRequest,
  constraints: GeneratePlanConstraints,
  program: ReturnType<typeof resolveProgramForGeneration>,
  options?: {
    correction?: unknown;
    assignedStrategy?: SchemeStrategy;
    priorSchemeNote?: string;
    versionCount?: number;
  }
) {
  return requestAnthropicTool({
    system: buildGenerateTopologySystemPrompt(buildTopologyPromptSupplement(body.projectType)),
    input: topologyInput(body, constraints, program, options),
    toolName: "generate_plan_topology",
    toolDescription:
      "Return EvoLab architectural room topology, target areas, and adjacency graph without final geometry.",
    schema: GeneratePlanTopologyToolInputSchema,
    maxTokens: 8192,
    maxValidationRetries: 2
  });
}

async function requestStrategicTopologies(
  body: GeneratePlanRequest,
  constraints: GeneratePlanConstraints,
  program: ReturnType<typeof resolveProgramForGeneration>
) {
  const collected: PlanTopologyVersion[] = [];

  for (let index = 0; index < SCHEME_STRATEGIES.length; index += 1) {
    const strategy = strategyForIndex(index);
    const priorSchemeNote = buildPriorSchemeNote(collected);
    const response = await requestTopologyPlan(body, constraints, program, {
      assignedStrategy: strategy,
      priorSchemeNote: priorSchemeNote || undefined,
      versionCount: 1,
      correction: {
        instruction: `Return exactly one topology for strategy "${strategy.label}". Emphasis: ${strategy.emphasis}`,
        priorSchemeNote
      }
    });

    const topology = response.versions[0];

    if (topology) {
      collected.push({
        ...topology,
        label: `Scheme ${String.fromCharCode(65 + index)} · ${strategy.label}`,
        strategy: strategy.id
      });
    }
  }

  return { versions: collected };
}

async function requestGeometryRefinement(
  version: PlanVersion,
  topology: PlanTopologyVersion,
  constraints: GeneratePlanConstraints,
  projectType: string | undefined,
  validationIssues: PlanValidationIssue[],
  envelopeIssues: string[],
  correction?: unknown
) {
  return requestAnthropicTool({
    system: buildRefineGeometrySystemPrompt(buildGeometryPromptSupplement(projectType)),
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
  program: ReturnType<typeof resolveProgramForGeneration>,
  projectType: string | undefined,
  warnings: string[],
  scoringOptions: PostProcessOptions
): Promise<PlanVersion | null> {
  let current = pair.version;
  let issues = validatePlanVersion(current).issues;
  let programIssues = validateVersionAgainstProgram(current, program).issues;
  let envelopeIssues = constraints.envelope
    ? envelopeErrorSummary([current], constraints.envelope, constraints.floors).map((item) => item.message)
    : [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const refined = await requestGeometryRefinement(
        current,
        pair.topology,
        constraints,
        projectType,
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

      current = postProcessPlanVersion(refined.version, scoringOptions);
      issues = validatePlanVersion(current).issues;
      programIssues = validateVersionAgainstProgram(current, program).issues;
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

      if (
        issues.every((issue) => issue.severity !== "error") &&
        programIssues.every((issue) => issue.severity !== "error") &&
        envelopeIssues.length === 0
      ) {
        return current;
      }
    } catch (error) {
      warnings.push(
        `${pair.version.label}: refinement failed (${error instanceof Error ? error.message : "unknown error"}).`
      );
      break;
    }
  }

  const hasOnlyWarnings =
    issues.every((issue) => issue.severity !== "error") &&
    programIssues.every((issue) => issue.severity !== "error");
  return hasOnlyWarnings && envelopeIssues.length === 0 ? current : null;
}

async function runTopologyPhase(
  body: GeneratePlanRequest,
  constraints: GeneratePlanConstraints,
  program: ReturnType<typeof resolveProgramForGeneration>
) {
  return requestStrategicTopologies(body, constraints, program);
}

function runGeometryPhase(
  topologies: PlanTopologyVersion[],
  layoutOptions: TopologyLayoutOptions
) {
  return topologiesToPlanVersions(topologies, layoutOptions);
}

async function retryTopologyPhase(
  body: GeneratePlanRequest,
  constraints: GeneratePlanConstraints,
  program: ReturnType<typeof resolveProgramForGeneration>,
  topologyData: { versions: PlanTopologyVersion[] },
  geometryErrors: ReturnType<typeof versionErrorSummary>,
  envelopeErrors: ReturnType<typeof envelopeErrorSummary>,
  programTopologyErrors: ReturnType<typeof programTopologyErrorSummary>,
  programGeometryErrors: ReturnType<typeof programVersionErrorSummary>
) {
  return requestTopologyPlan(body, constraints, program, {
    correction: {
      reason: "Previous topology produced geometry outside spatial, zoning, or program constraints.",
      errors: [...geometryErrors, ...envelopeErrors, ...programTopologyErrors, ...programGeometryErrors],
      instruction: constraints.envelope
        ? "Reduce target areas and room count to fit inside buildableEnvelope footprint and floor-area cap."
        : "Return corrected topology only. Honor program.required spaces, area bounds, and must-adjacency rules.",
      programRequirements: program.spaces
        .filter((space) => space.priority === "required")
        .map((space) => ({
          name: space.name,
          roomType: space.roomType,
          minAreaSqm: space.minAreaSqm,
          maxAreaSqm: space.maxAreaSqm,
          targetAreaSqm: space.targetAreaSqm
        }))
    },
    versionCount: topologyData.versions.length
  });
}

async function runRefinementPhase(
  pairs: TopologyGeometryPair[],
  constraints: GeneratePlanConstraints,
  program: ReturnType<typeof resolveProgramForGeneration>,
  projectType: string | undefined,
  warnings: string[],
  scoringOptions: PostProcessOptions
) {
  const refinedVersions: PlanVersion[] = [];
  let refinedCount = 0;

  for (const pair of pairs) {
    const refined = await refineVersionPair(pair, constraints, program, projectType, warnings, scoringOptions);
    if (refined) {
      refinedVersions.push(refined);
      refinedCount += 1;
    } else {
      warnings.push(`${pair.version.label}: kept algorithmic geometry after refinement attempts failed.`);
      const fallbackIssues = validatePlanVersion(pair.version).issues;
      const fallbackProgramIssues = validateVersionAgainstProgram(pair.version, program).issues;
      const fallbackEnvelopeIssues = envelopeErrorSummary([pair.version], constraints.envelope, constraints.floors);
      if (
        fallbackIssues.every((issue) => issue.severity !== "error") &&
        fallbackProgramIssues.every((issue) => issue.severity !== "error") &&
        fallbackEnvelopeIssues.length === 0
      ) {
        refinedVersions.push(pair.version);
      }
    }
  }

  return { refinedVersions, refinedCount };
}

export async function runGeneratePlanPipeline(body: GeneratePlanRequest): Promise<GeneratePlanPipelineResult> {
  const warnings: string[] = [];
  const constraints = resolveGeneratePlanConstraints(body);
  const program = resolveProgramForGeneration(body);
  const scoringOptions = postProcessOptions(body, program);
  const layoutOptions = topologyLayoutOptions(constraints, body.projectType);
  const meta: GeneratePlanPipelineMeta = {
    phases: { topology: false, geometry: false, refinement: false },
    topologyCount: 0,
    refinedCount: 0,
    warnings,
    envelopeApplied: Boolean(constraints.envelope),
    programApplied: program.spaces.length > 0
  };

  if (constraints.envelope) {
    warnings.push(
      `Zoning envelope active: setback footprint ${constraints.envelope.maxFloorAreaSqm} sqm, max height ${constraints.envelope.maxHeightMeters}m.`
    );
  }

  if (program.spaces.length) {
    warnings.push(`Functional program active: ${program.spaces.length} spaces, ${program.spaces.filter((space) => space.priority === "required").length} required.`);
  }

  let topologyData = await runTopologyPhase(body, constraints, program);
  meta.phases.topology = true;
  meta.topologyCount = topologyData.versions.length;

  let versions = runGeometryPhase(topologyData.versions, layoutOptions);
  meta.phases.geometry = true;

  let geometryErrors = versionErrorSummary(versions);
  let envelopeErrors = envelopeErrorSummary(versions, constraints.envelope, constraints.floors);
  let programTopologyErrors = programTopologyErrorSummary(topologyData.versions, program);
  let programGeometryErrors = programVersionErrorSummary(versions, program);

  if (
    geometryErrors.length > 0 ||
    envelopeErrors.length > 0 ||
    programTopologyErrors.length > 0 ||
    programGeometryErrors.length > 0
  ) {
    topologyData = await retryTopologyPhase(
      body,
      constraints,
      program,
      topologyData,
      geometryErrors,
      envelopeErrors,
      programTopologyErrors,
      programGeometryErrors
    );
    meta.topologyCount = topologyData.versions.length;
    versions = runGeometryPhase(topologyData.versions, layoutOptions);
    geometryErrors = versionErrorSummary(versions);
    envelopeErrors = envelopeErrorSummary(versions, constraints.envelope, constraints.floors);
    programTopologyErrors = programTopologyErrorSummary(topologyData.versions, program);
    programGeometryErrors = programVersionErrorSummary(versions, program);
  }

  if (versions.length === 0) {
    return { versions: [], meta };
  }

  if (envelopeErrors.length > 0) {
    warnings.push(...envelopeErrors.map((error) => `${error.versionId}: ${error.message}`));
  }

  if (programTopologyErrors.length > 0 || programGeometryErrors.length > 0) {
    warnings.push(
      ...[...programTopologyErrors, ...programGeometryErrors].map(
        (error) => `${error.versionId}: program ${error.message}`
      )
    );
  }

  const pairs = pairTopologiesWithVersions(topologyData.versions, versions);
  const { refinedVersions, refinedCount } = await runRefinementPhase(
    pairs,
    constraints,
    program,
    body.projectType,
    warnings,
    scoringOptions
  );
  meta.refinedCount = refinedCount;
  meta.phases.refinement = refinedCount > 0;

  const candidates =
    refinedVersions.length > 0
      ? refinedVersions
      : versions.filter((version) => {
          const spatialErrors = versionErrorSummary([version]);
          const zoningErrors = envelopeErrorSummary([version], constraints.envelope, constraints.floors);
          const programErrors = programVersionErrorSummary([version], program);
          return spatialErrors.length === 0 && zoningErrors.length === 0 && programErrors.length === 0;
        });

  const finalValidation = validateFinalVersions(candidates);

  if (!finalValidation.valid) {
    warnings.push(finalValidation.warning ?? "Final Zod validation failed.");
    return { versions: [], meta };
  }

  const scoringInput = {
    program,
    projectType: body.projectType,
    orientationDeg: resolveOrientationDeg(body)
  };

  const expanded = finalValidation.versions.map((version, index) => {
      const pair = pairs.find((item) => item.version.id === version.id) ?? pairs[index];
      const topologyGraph = pair
        ? topologyGraphFromTopology(pair.topology)
        : version.metadata?.topologyGraph;

      const programValidation = validateVersionAgainstProgram(version, program);
      const strategy = strategyForIndex(index);

      const stamped = applyStrategyLabel(
        {
          ...version,
          metadata: {
            ...version.metadata,
            topologyGraph,
            zoningApplied: Boolean(constraints.envelope),
            envelopeCompliant: true,
            programCompliant: programValidation.valid,
            programValidationWarnings: programValidation.issues
              .filter((issue) => issue.severity === "warning")
              .map((issue) => issue.message),
            pipelinePhases: meta.phases
          }
        },
        strategy,
        String.fromCharCode(65 + index)
      );

      return expandPlanVersionToFloors(stamped, constraints.floors);
    });

  return {
    versions: rescoreVersions(expanded, scoringInput),
    meta
  };
}
