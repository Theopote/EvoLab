import { describe, expect, it } from "vitest";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import { groupComplianceItems, prioritizeComplianceItems } from "@/lib/compliance-groups";
import { buildComplianceContext, prioritizeComplianceResults, runComplianceCheck } from "@/lib/compliance-rules";
import { buildCopilotInsightsFromEngines } from "@/lib/copilot-insight-queue";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { routeMepLayout } from "@/lib/mep-router";
import { checkCompliance } from "@/lib/quantity-engine";
import { resolveRulePack } from "@/lib/rules/rule-pack";

const baseVersion = initialProjectData.versions[0]!;
const rulePack = resolveRulePack({ codeContext: defaultHealthcareCodeContext, projectType: "healthcare" });

describe("compliance groups", () => {
  it("groups multi-floor compliance rows by level and building-wide scope", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const items = checkCompliance(expanded, defaultHealthcareCodeContext, rulePack, { buildingType: "healthcare" });
    const groups = groupComplianceItems(items, expanded);

    expect(groups.some((group) => group.kind === "building_wide")).toBe(true);
    expect(groups.filter((group) => group.kind === "level").length).toBe(4);
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });

  it("prioritizes active-floor compliance rows for copilot insights", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const ctx = buildComplianceContext(expanded, rulePack, { buildingType: "healthcare" });
    const prioritized = prioritizeComplianceResults(runComplianceCheck(ctx), "level-02");
    const firstLevelSpecific = prioritized.find((item) => item.levelId);

    expect(firstLevelSpecific?.levelId).toBe("level-02");
  });

  it("builds active-floor aware copilot findings", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const findings = buildCopilotInsightsFromEngines(
      expanded,
      initialProjectData.domain,
      "healthcare",
      "level-02"
    );

    expect(findings.some((finding) => finding.sub?.includes("Active floor"))).toBe(true);
  });
});

describe("mep shaft stacks", () => {
  it("derives one or more shaft stacks from vertical elements", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const mep = routeMepLayout(expanded);

    expect(mep.shafts.length).toBeGreaterThan(0);
    expect(mep.shafts[0]?.levelIds?.length).toBeGreaterThan(0);
  });
});

describe("prioritizeComplianceItems", () => {
  it("sorts active level warnings first", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const items = checkCompliance(expanded, defaultHealthcareCodeContext, rulePack, { buildingType: "healthcare" });
    const prioritized = prioritizeComplianceItems(items, "level-03");
    const firstLevelItem = prioritized.find((item) => item.levelId);

    expect(firstLevelItem?.levelId).toBe("level-03");
  });
});
