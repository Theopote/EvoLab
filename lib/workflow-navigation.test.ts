import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { createDefaultProjectDomain } from "@/lib/project-domain";
import { defaultZoningConstraints } from "@/lib/site-types";
import {
  legacyTabAlias,
  normalizeDeliverSubview,
  normalizeSchemeSubview,
  normalizeWorkflowPhase,
  normalizeWorkspaceTab,
  phaseForTab,
  recommendedNextStep,
  recommendedNextStepDetail,
  resolvePhaseTab,
  resolveView,
  tabForDeliverSubview,
  tabForSchemeSubview,
  workflowPhaseDefinitions
} from "@/lib/workflow-navigation";

describe("workflow-navigation", () => {
  it("defines seven primary workflow phases", () => {
    expect(workflowPhaseDefinitions.map((item) => item.id)).toEqual([
      "import",
      "site",
      "program",
      "scheme",
      "analyze",
      "quantify",
      "deliver"
    ]);
  });

  it("normalizes legacy workflow phase and tab aliases", () => {
    expect(normalizeWorkflowPhase("brief_site")).toBe("site");
    expect(normalizeWorkspaceTab("Model")).toBe("Massing");
    expect(normalizeWorkspaceTab("Sheets")).toBe("Presentation");
    expect(legacyTabAlias.Model).toBe("Massing");
    expect(legacyTabAlias.Sheets).toBe("Presentation");
  });

  it("maps canonical tabs to phases", () => {
    expect(phaseForTab("Import")).toBe("import");
    expect(phaseForTab("Site")).toBe("site");
    expect(phaseForTab("Program")).toBe("program");
    expect(phaseForTab("Compare")).toBe("scheme");
    expect(phaseForTab("Review")).toBe("quantify");
    expect(phaseForTab("Presentation")).toBe("deliver");
    expect(phaseForTab("Model")).toBe("scheme");
    expect(phaseForTab("Sheets")).toBe("deliver");
  });

  it("resolves phase tabs for single-page and sub-nav phases", () => {
    expect(resolvePhaseTab("import", "Plan")).toBe("Import");
    expect(resolvePhaseTab("site", "Plan")).toBe("Site");
    expect(resolvePhaseTab("program", "Plan")).toBe("Program");
    expect(resolvePhaseTab("scheme", "Analysis")).toBe("Plan");
    expect(resolvePhaseTab("quantify", "Plan")).toBe("Quantity");
    expect(resolvePhaseTab("deliver", "Plan")).toBe("Presentation");
    expect(resolvePhaseTab("deliver", "Sheets")).toBe("Presentation");
  });

  it("normalizes legacy subviews", () => {
    expect(normalizeSchemeSubview("model")).toBe("massing");
    expect(normalizeDeliverSubview("sheets")).toBe("presentation");
    expect(tabForSchemeSubview("model")).toBe("Model");
    expect(tabForDeliverSubview("sheets")).toBe("Presentation");
  });

  it("builds a resolved workflow view", () => {
    const view = resolveView("scheme", "Compare");
    expect(view.phase).toBe("scheme");
    expect(view.tab).toBe("Compare");
    expect(view.schemeSubview).toBe("compare");
  });

  it("recommends import when the project has no versions", () => {
    const emptyProject = {
      ...initialProjectData,
      versions: [],
      domain: createDefaultProjectDomain({
        projectType: "healthcare",
        brief: {
          projectType: "healthcare",
          description: "",
          floors: 1,
          targetArea: 1000,
          corePreference: "",
          orientationPreference: ""
        },
        outline: initialProjectData.versions[0]!.outline,
        zoning: defaultZoningConstraints
      })
    };

    expect(recommendedNextStep(emptyProject)).toBe("import");
    expect(recommendedNextStepDetail(emptyProject)).toMatchObject({
      phase: "import",
      label: "Import"
    });
  });
});
