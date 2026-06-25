import { pendingChangeSets } from "@/lib/project-domain";
import type { ProjectData, WorkspaceTab } from "@/lib/project-types";
import { workspaceTabs } from "@/lib/project-types";

export type WorkflowPhase =
  | "import"
  | "site"
  | "program"
  | "scheme"
  | "analyze"
  | "quantify"
  | "deliver";

/** @deprecated Use `site` — kept for persisted state and Copilot payloads. */
export type LegacyWorkflowPhase = "brief_site";

export type WorkflowPhaseId = WorkflowPhase | LegacyWorkflowPhase;

export type SchemeSubview = "bubble" | "plan" | "compare" | "massing" | "facade" | "structure" | "furniture";

/** @deprecated Use `massing` — 3D model lives under Massing / scheme split viewport. */
export type LegacySchemeSubview = "model";

export type SchemeSubviewId = SchemeSubview | LegacySchemeSubview;

export type AnalyzeSubview = "analysis" | "systems";

export type DeliverSubview = "presentation" | "render" | "export";

/** @deprecated Use `presentation`. */
export type LegacyDeliverSubview = "sheets";

export type DeliverSubviewId = DeliverSubview | LegacyDeliverSubview;

export type QuantifySubview = "quantity" | "review";

export interface WorkflowPhaseDefinition {
  id: WorkflowPhase;
  label: string;
  description: string;
  defaultTab: WorkspaceTab;
}

export const workflowPhaseDefinitions: WorkflowPhaseDefinition[] = [
  {
    id: "import",
    label: "Import",
    description: "Upload CAD, PDF, or raster drawings to seed the project",
    defaultTab: "Import"
  },
  {
    id: "site",
    label: "Site",
    description: "Site outline, GIS context, zoning envelope, buildable area",
    defaultTab: "Site"
  },
  {
    id: "program",
    label: "Program",
    description: "Functional brief, space program, code context, scoring goals",
    defaultTab: "Program"
  },
  {
    id: "scheme",
    label: "Scheme",
    description: "Bubble diagram, plan editing, compare, massing, facade, structure",
    defaultTab: "Plan"
  },
  {
    id: "analyze",
    label: "Analyze",
    description: "Circulation, daylight, egress overlays and MEP systems",
    defaultTab: "Analysis"
  },
  {
    id: "quantify",
    label: "Quantify",
    description: "Areas, schedules, compliance, change-set review",
    defaultTab: "Quantity"
  },
  {
    id: "deliver",
    label: "Deliver",
    description: "Presentation decks, renders, and export packages",
    defaultTab: "Presentation"
  }
];

/** Maps legacy tab ids from Copilot / persisted UI state to canonical workspace tabs. */
export const legacyTabAlias: Partial<Record<string, WorkspaceTab>> = {
  Model: "Massing",
  Sheets: "Presentation"
};

const workspaceTabSet = new Set<string>(workspaceTabs);

const tabToPhase: Record<WorkspaceTab, WorkflowPhase> = {
  Import: "import",
  Site: "site",
  Program: "program",
  Bubble: "scheme",
  Plan: "scheme",
  Compare: "scheme",
  Massing: "scheme",
  Model: "scheme",
  Facade: "scheme",
  Structure: "scheme",
  Furniture: "scheme",
  Analysis: "analyze",
  Systems: "analyze",
  Quantity: "quantify",
  Review: "quantify",
  Presentation: "deliver",
  Sheets: "deliver",
  Render: "deliver",
  Export: "deliver"
};

const schemeTabMap: Record<SchemeSubviewId, WorkspaceTab> = {
  bubble: "Bubble",
  plan: "Plan",
  compare: "Compare",
  massing: "Massing",
  model: "Model",
  facade: "Facade",
  structure: "Structure",
  furniture: "Furniture"
};

const analyzeTabMap: Record<AnalyzeSubview, WorkspaceTab> = {
  analysis: "Analysis",
  systems: "Systems"
};

const deliverTabMap: Record<DeliverSubviewId, WorkspaceTab> = {
  presentation: "Presentation",
  render: "Render",
  export: "Export",
  sheets: "Sheets"
};

const quantifyTabMap: Record<QuantifySubview, WorkspaceTab> = {
  quantity: "Quantity",
  review: "Review"
};

export interface WorkflowView {
  phase: WorkflowPhase;
  tab: WorkspaceTab;
  schemeSubview?: SchemeSubview;
  analyzeSubview?: AnalyzeSubview;
  deliverSubview?: DeliverSubview;
  quantifySubview?: QuantifySubview;
}

export function normalizeWorkflowPhase(phase: WorkflowPhaseId): WorkflowPhase {
  if (phase === "brief_site") {
    return "site";
  }

  return phase;
}

export function normalizeWorkspaceTab(tab: string): WorkspaceTab {
  const aliased = legacyTabAlias[tab];
  if (aliased) {
    return aliased;
  }

  if (workspaceTabSet.has(tab)) {
    return tab as WorkspaceTab;
  }

  return "Plan";
}

export function normalizeSchemeSubview(subview: SchemeSubviewId): SchemeSubview {
  if (subview === "model") {
    return "massing";
  }

  return subview;
}

export function normalizeDeliverSubview(subview: DeliverSubviewId): DeliverSubview {
  if (subview === "sheets") {
    return "presentation";
  }

  return subview;
}

export function isBriefContextPhase(phase: WorkflowPhaseId): boolean {
  const normalized = normalizeWorkflowPhase(phase);
  return normalized === "import" || normalized === "site" || normalized === "program";
}

export function phaseForTab(tab: WorkspaceTab): WorkflowPhase {
  return tabToPhase[normalizeWorkspaceTab(tab)];
}

export function schemeSubviewForTab(tab: WorkspaceTab): SchemeSubviewId | undefined {
  const canonical = normalizeWorkspaceTab(tab);

  if (canonical === "Bubble") {
    return "bubble";
  }

  if (canonical === "Plan") {
    return "plan";
  }

  if (canonical === "Compare") {
    return "compare";
  }

  if (canonical === "Massing") {
    return "massing";
  }

  if (tab === "Model") {
    return "model";
  }

  if (canonical === "Facade") {
    return "facade";
  }

  if (canonical === "Structure") {
    return "structure";
  }

  if (canonical === "Furniture") {
    return "furniture";
  }

  return undefined;
}

export function analyzeSubviewForTab(tab: WorkspaceTab): AnalyzeSubview | undefined {
  const canonical = normalizeWorkspaceTab(tab);

  if (canonical === "Analysis") {
    return "analysis";
  }

  if (canonical === "Systems") {
    return "systems";
  }

  return undefined;
}

export function deliverSubviewForTab(tab: WorkspaceTab): DeliverSubviewId | undefined {
  const canonical = normalizeWorkspaceTab(tab);

  if (canonical === "Presentation") {
    return "presentation";
  }

  if (tab === "Sheets") {
    return "sheets";
  }

  if (canonical === "Export") {
    return "export";
  }

  if (canonical === "Render") {
    return "render";
  }

  return undefined;
}

export function quantifySubviewForTab(tab: WorkspaceTab): QuantifySubview | undefined {
  const canonical = normalizeWorkspaceTab(tab);

  if (canonical === "Quantity") {
    return "quantity";
  }

  if (canonical === "Review") {
    return "review";
  }

  return undefined;
}

export function tabForSchemeSubview(subview: SchemeSubviewId): WorkspaceTab {
  return schemeTabMap[subview];
}

export function tabForAnalyzeSubview(subview: AnalyzeSubview): WorkspaceTab {
  return analyzeTabMap[subview];
}

export function tabForDeliverSubview(subview: DeliverSubviewId): WorkspaceTab {
  return deliverTabMap[subview];
}

export function tabForQuantifySubview(subview: QuantifySubview): WorkspaceTab {
  return quantifyTabMap[subview];
}

export function defaultTabForPhase(phase: WorkflowPhaseId): WorkspaceTab {
  const normalized = normalizeWorkflowPhase(phase);
  return workflowPhaseDefinitions.find((item) => item.id === normalized)?.defaultTab ?? "Plan";
}

export function resolvePhaseTab(phase: WorkflowPhaseId, currentTab: WorkspaceTab): WorkspaceTab {
  const normalizedPhase = normalizeWorkflowPhase(phase);
  const canonicalCurrent = normalizeWorkspaceTab(currentTab);

  if (phaseForTab(currentTab) === normalizedPhase) {
    if (normalizedPhase === "scheme" && canonicalCurrent === "Plan") {
      return currentTab;
    }

    return canonicalCurrent;
  }

  if (normalizedPhase === "import") {
    return "Import";
  }

  if (normalizedPhase === "site") {
    return "Site";
  }

  if (normalizedPhase === "program") {
    return "Program";
  }

  if (normalizedPhase === "scheme") {
    return tabForSchemeSubview(schemeSubviewForTab(currentTab) ?? "plan");
  }

  if (normalizedPhase === "analyze") {
    return tabForAnalyzeSubview(analyzeSubviewForTab(currentTab) ?? "analysis");
  }

  if (normalizedPhase === "quantify") {
    return tabForQuantifySubview(quantifySubviewForTab(currentTab) ?? "quantity");
  }

  if (normalizedPhase === "deliver") {
    return tabForDeliverSubview(deliverSubviewForTab(currentTab) ?? "presentation");
  }

  return defaultTabForPhase(normalizedPhase);
}

export function resolveView(phase: WorkflowPhaseId, tab?: WorkspaceTab): WorkflowView {
  const normalizedPhase = normalizeWorkflowPhase(phase);
  const resolvedTab = tab ? normalizeWorkspaceTab(tab) : defaultTabForPhase(normalizedPhase);
  const view: WorkflowView = {
    phase: normalizedPhase,
    tab: resolvePhaseTab(normalizedPhase, resolvedTab)
  };

  const schemeSubview = schemeSubviewForTab(view.tab);
  if (schemeSubview) {
    view.schemeSubview = normalizeSchemeSubview(schemeSubview);
  }

  const analyzeSubview = analyzeSubviewForTab(view.tab);
  if (analyzeSubview) {
    view.analyzeSubview = analyzeSubview;
  }

  const quantifySubview = quantifySubviewForTab(view.tab);
  if (quantifySubview) {
    view.quantifySubview = quantifySubview;
  }

  const deliverSubview = deliverSubviewForTab(view.tab);
  if (deliverSubview) {
    view.deliverSubview = normalizeDeliverSubview(deliverSubview);
  }

  return view;
}

export function visiblePhases(project: ProjectData): WorkflowPhase[] {
  return workflowPhaseDefinitions.map((definition) => definition.id);
}

export function recommendedNextStep(project: ProjectData): WorkflowPhase | null {
  if (!project.versions.length) {
    return "import";
  }

  if (!project.domain.program.spaces.length) {
    return "program";
  }

  const activeVersion = project.versions.find((version) => version.id === project.activeVersionId);
  if (!activeVersion?.rooms.length) {
    return "scheme";
  }

  if (pendingChangeSets(project.domain).length > 0) {
    return "quantify";
  }

  return null;
}

export function recommendedNextStepDetail(project: ProjectData): {
  phase: WorkflowPhase;
  label: string;
  description: string;
} | null {
  const phase = recommendedNextStep(project);
  if (!phase) {
    return null;
  }

  const definition = workflowPhaseDefinitions.find((item) => item.id === phase);
  if (!definition) {
    return null;
  }

  return {
    phase,
    label: definition.label,
    description: definition.description
  };
}
