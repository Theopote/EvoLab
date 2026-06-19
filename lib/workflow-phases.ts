import type { WorkspaceTab } from "@/lib/project-types";

export type WorkflowPhase = "brief_site" | "scheme" | "analyze" | "quantify" | "review" | "deliver";

export type BriefSiteSubview = "site" | "program" | "intake";
export type SchemeSubview = "plan" | "massing" | "model" | "structure" | "facade";
export type AnalyzeSubview = "analysis" | "systems";
export type QuantifySubview = "quantity" | "schedules" | "compliance";
export type DeliverSubview = "sheets" | "export" | "render";

export interface WorkflowPhaseDefinition {
  id: WorkflowPhase;
  label: string;
  description: string;
  defaultTab: WorkspaceTab;
}

export const workflowPhaseDefinitions: WorkflowPhaseDefinition[] = [
  {
    id: "brief_site",
    label: "Intake",
    description: "Site outline, functional program, and drawing import",
    defaultTab: "Plan"
  },
  {
    id: "scheme",
    label: "Scheme",
    description: "Generate options, edit plan, massing, structure, facade and 3D model",
    defaultTab: "Plan"
  },
  {
    id: "analyze",
    label: "Analyze",
    description: "Circulation, daylight, sightline and MEP overlays",
    defaultTab: "Analysis"
  },
  {
    id: "quantify",
    label: "Quantify",
    description: "Areas, schedules, compliance checks and cost ROM",
    defaultTab: "Quantity"
  },
  {
    id: "review",
    label: "Review",
    description: "Approve change sets and Copilot proposals",
    defaultTab: "Quantity"
  },
  {
    id: "deliver",
    label: "Deliver",
    description: "Automated presentation, sheets and export",
    defaultTab: "Sheets"
  }
];

const tabToPhase: Record<WorkspaceTab, WorkflowPhase> = {
  Plan: "brief_site",
  Massing: "scheme",
  Model: "scheme",
  Structure: "scheme",
  Facade: "scheme",
  Analysis: "analyze",
  Systems: "analyze",
  Quantity: "quantify",
  Render: "deliver",
  Sheets: "deliver",
  Export: "deliver"
};

const schemeTabMap: Record<SchemeSubview, WorkspaceTab> = {
  plan: "Plan",
  massing: "Massing",
  model: "Model",
  structure: "Structure",
  facade: "Facade"
};

const analyzeTabMap: Record<AnalyzeSubview, WorkspaceTab> = {
  analysis: "Analysis",
  systems: "Systems"
};

const deliverTabMap: Record<DeliverSubview, WorkspaceTab> = {
  sheets: "Sheets",
  export: "Export",
  render: "Render"
};

export function phaseForTab(tab: WorkspaceTab): WorkflowPhase {
  return tabToPhase[tab];
}

export function schemeSubviewForTab(tab: WorkspaceTab): SchemeSubview | undefined {
  if (tab === "Plan") {
    return "plan";
  }

  if (tab === "Massing") {
    return "massing";
  }

  if (tab === "Model") {
    return "model";
  }

  if (tab === "Structure") {
    return "structure";
  }

  if (tab === "Facade") {
    return "facade";
  }

  return undefined;
}

export function analyzeSubviewForTab(tab: WorkspaceTab): AnalyzeSubview | undefined {
  if (tab === "Analysis") {
    return "analysis";
  }

  if (tab === "Systems") {
    return "systems";
  }

  return undefined;
}

export function deliverSubviewForTab(tab: WorkspaceTab): DeliverSubview | undefined {
  if (tab === "Sheets") {
    return "sheets";
  }

  if (tab === "Export") {
    return "export";
  }

  if (tab === "Render") {
    return "render";
  }

  return undefined;
}

export function tabForSchemeSubview(subview: SchemeSubview): WorkspaceTab {
  return schemeTabMap[subview];
}

export function tabForAnalyzeSubview(subview: AnalyzeSubview): WorkspaceTab {
  return analyzeTabMap[subview];
}

export function tabForDeliverSubview(subview: DeliverSubview): WorkspaceTab {
  return deliverTabMap[subview];
}

export function defaultTabForPhase(phase: WorkflowPhase): WorkspaceTab {
  return workflowPhaseDefinitions.find((item) => item.id === phase)?.defaultTab ?? "Plan";
}

export function defaultBriefSiteSubview(): BriefSiteSubview {
  return "site";
}

export function defaultQuantifySubview(): QuantifySubview {
  return "quantity";
}

export function resolvePhaseTab(phase: WorkflowPhase, currentTab: WorkspaceTab): WorkspaceTab {
  if (phase === "review") {
    return currentTab;
  }

  if (phase === "brief_site") {
    return "Plan";
  }

  if (phaseForTab(currentTab) === phase || (phase === "scheme" && currentTab === "Plan")) {
    return currentTab;
  }

  if (phase === "scheme") {
    return tabForSchemeSubview(schemeSubviewForTab(currentTab) ?? "plan");
  }

  if (phase === "analyze") {
    return tabForAnalyzeSubview(analyzeSubviewForTab(currentTab) ?? "analysis");
  }

  if (phase === "quantify") {
    return "Quantity";
  }

  if (phase === "deliver") {
    return tabForDeliverSubview(deliverSubviewForTab(currentTab) ?? "sheets");
  }

  return defaultTabForPhase(phase);
}
