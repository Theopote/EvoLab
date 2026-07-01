import { normalizeProjectVersions } from "@/lib/architecture-model";
import { getBuildingType } from "@/lib/building-types/catalog";
import { normalizeProjectData } from "@/lib/project-domain";
import type { DesignBrief, ProjectData } from "@/lib/project-types";
import { defaultZoningConstraints } from "@/lib/site-types";
import { briefFromTypologyPack } from "@/lib/typologies/domain";
import { DEMO_PROJECT_OUTLINE } from "@/lib/typologies/defaults";
import { createMockPlanVersionsFromPack } from "@/lib/typology/layouts";
import { resolveTypologyPack } from "@/lib/typology/resolve";
import type { WorkflowPhase } from "@/lib/workflow-phases";
import type { WorkspacePersistedSnapshot } from "@/lib/store/workspace-history";
import type { WorkspaceTab } from "@/lib/project-types";

export type ProjectStartMode = "blank" | "demo";

export interface CreateProjectInput {
  projectName: string;
  buildingTypeId: string;
  startMode?: ProjectStartMode;
}

export interface ProjectCreationBundle {
  project: ProjectData;
  brief: DesignBrief;
  workflowPhase: WorkflowPhase;
  activeTab: WorkspaceTab;
}

export function createProjectId() {
  return `evolab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function demoProjectIdForTypology(typologyId: string) {
  return `evolab-demo-${typologyId}`;
}

function buildBrief(buildingTypeId: string): DesignBrief {
  const buildingType = getBuildingType(buildingTypeId);
  return briefFromTypologyPack(buildingType.typologyPackId, {
    projectType: buildingType.id,
    description: buildingType.description
  });
}

export function createBlankProjectBundle(input: CreateProjectInput, projectId = createProjectId()): ProjectCreationBundle {
  const buildingType = getBuildingType(input.buildingTypeId);
  const brief = buildBrief(buildingType.id);
  const project = normalizeProjectData(
    {
      projectId,
      projectName: input.projectName.trim() || `未命名${buildingType.labelZh}`,
      projectType: buildingType.id,
      activeVersionId: "",
      versions: []
    },
    {
      brief,
      outline: DEMO_PROJECT_OUTLINE,
      zoning: defaultZoningConstraints
    }
  );

  return {
    project,
    brief,
    workflowPhase: "import",
    activeTab: "Import"
  };
}

export function createDemoProjectBundle(input: CreateProjectInput, projectId = createProjectId()): ProjectCreationBundle {
  const buildingType = getBuildingType(input.buildingTypeId);
  const pack = resolveTypologyPack(buildingType.typologyPackId);
  const brief = buildBrief(buildingType.id);
  const [primaryScheme] = createMockPlanVersionsFromPack(pack, DEMO_PROJECT_OUTLINE);

  if (!primaryScheme) {
    throw new Error(`Typology pack "${pack.id}" did not produce a demo scheme.`);
  }

  const project = normalizeProjectData(
    {
      projectId,
      projectName: input.projectName.trim() || `${buildingType.labelZh}概念方案`,
      projectType: buildingType.id,
      activeVersionId: primaryScheme.id,
      versions: normalizeProjectVersions([primaryScheme])
    },
    {
      brief,
      outline: DEMO_PROJECT_OUTLINE,
      zoning: defaultZoningConstraints
    }
  );

  return {
    project,
    brief,
    workflowPhase: "scheme",
    activeTab: "Plan"
  };
}

export function createProjectBundle(input: CreateProjectInput, projectId = createProjectId()): ProjectCreationBundle {
  return input.startMode === "demo" ? createDemoProjectBundle(input, projectId) : createBlankProjectBundle(input, projectId);
}

export function createInitialWorkspaceSnapshot(bundle: ProjectCreationBundle, projectId: string): WorkspacePersistedSnapshot {
  return {
    projectId,
    savedAt: new Date().toISOString(),
    project: JSON.parse(JSON.stringify(bundle.project)),
    brief: JSON.parse(JSON.stringify(bundle.brief)),
    workflowPhase: bundle.workflowPhase,
    activeTab: bundle.activeTab,
    outline: JSON.parse(JSON.stringify(DEMO_PROJECT_OUTLINE)),
    outlineClosed: true,
    zoning: JSON.parse(JSON.stringify(defaultZoningConstraints)),
    undoStack: [],
    copilotTimelineEntries: []
  };
}
