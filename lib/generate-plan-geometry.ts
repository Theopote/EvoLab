import type { PlanVersionDraft } from "@/lib/architecture-model";
import type { GeneratePlanConstraints } from "@/lib/generate-plan-constraints";
import { postProcessPlanVersion, type PostProcessOptions } from "@/lib/plan-postprocess";
import type { GeneratePlanRequest } from "@/lib/schemas/generate-plan-request-schema";
import type { PlanTopologyVersion } from "@/lib/schemas/plan-version-schema";
import { topologyGraphFromTopology } from "@/lib/topology-graph";
import { resolveTopologyLayout } from "@/lib/topology-geometry";
import type { PlanVersion, Point } from "@/lib/project-types";

export interface GeometryPhaseInput {
  topology: PlanTopologyVersion;
  outline: Point[];
  layoutOutline: Point[];
  overallBounds: { width: number; height: number };
  buildableEnvelope?: GeneratePlanConstraints["envelope"];
  brief?: string;
  designBrief?: GeneratePlanRequest["designBrief"];
  projectType?: string;
  correction?: unknown;
}

export function buildGeometryPhaseInput(
  topology: PlanTopologyVersion,
  constraints: GeneratePlanConstraints,
  body: GeneratePlanRequest,
  correction?: unknown
): GeometryPhaseInput {
  const { localizedSite, localizedLayout, bounds } = resolveTopologyLayout({
    siteOutline: constraints.siteOutline,
    layoutOutline: constraints.layoutOutline
  });

  return {
    topology,
    outline: localizedSite,
    layoutOutline: localizedLayout,
    overallBounds: {
      width: bounds.width,
      height: bounds.height
    },
    buildableEnvelope: constraints.envelope,
    brief: body.brief,
    designBrief: body.designBrief,
    projectType: body.projectType,
    correction
  };
}

export function finalizePlanGeometryVersion(
  draft: PlanVersionDraft,
  topology: PlanTopologyVersion,
  localizedSiteOutline: Point[],
  scoringOptions?: PostProcessOptions
): PlanVersion {
  const versionDraft: PlanVersionDraft = {
    ...draft,
    id: draft.id || topology.id,
    label: draft.label || topology.label,
    createdAt: draft.createdAt || new Date().toISOString(),
    outline: draft.outline.length >= 3 ? draft.outline : localizedSiteOutline,
    metadata: {
      ...draft.metadata,
      strategy: topology.strategy,
      topology: topology.topology,
      topologyGraph: topologyGraphFromTopology(topology)
    }
  };

  return postProcessPlanVersion(versionDraft, scoringOptions);
}
