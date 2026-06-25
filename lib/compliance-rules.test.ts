import { describe, expect, it } from "vitest";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import {
  buildComplianceContext,
  computeRiskCount,
  generateComplianceInsights,
  resolveComplianceFix,
  runComplianceCheck
} from "@/lib/compliance-rules";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { checkCompliance } from "@/lib/quantity-engine";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import type { PlanVersion, Point } from "@/lib/project-types";
import { deriveVerticalElements } from "@/lib/vertical-elements";

const baseVersion = initialProjectData.versions[0]!;
const rulePack = resolveRulePack({ codeContext: defaultHealthcareCodeContext, projectType: "healthcare" });

describe("compliance-rules", () => {
  it("runs per-floor rules for a single-level version", () => {
    const ctx = buildComplianceContext(baseVersion, rulePack, { buildingType: "healthcare" });
    const results = runComplianceCheck(ctx);

    expect(results.some((item) => item.ruleId === "corridor-width")).toBe(true);
    expect(results.some((item) => item.ruleId === "egress-distance")).toBe(true);
    expect(results.every((item) => item.scope === "per_floor" || item.ruleId === "vertical_alignment")).toBe(true);
  });

  it("registers vertical alignment and stair egress width as building-wide rules", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const ctx = buildComplianceContext(expanded, rulePack, { buildingType: "healthcare" });
    const results = runComplianceCheck(ctx);

    expect(results.some((item) => item.ruleId === "vertical_alignment")).toBe(true);
    expect(results.some((item) => item.ruleId === "stair-egress-width")).toBe(true);
    expect(results.find((item) => item.ruleId === "stair-egress-width")?.scope).toBe("building_wide");
  });

  it("maps vertical alignment issues to single-floor fixes by default", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const elements = deriveVerticalElements(expanded);
    const firstColumn = elements.find((element) => element.kind === "column");

    expect(firstColumn).toBeDefined();

    const tampered: PlanVersion = {
      ...expanded,
      levels: expanded.levels.map((level) =>
        level.id === "level-01"
          ? {
              ...level,
              rooms: level.rooms.map((room) =>
                room.type === "corridor"
                  ? {
                      ...room,
                      polygon: room.polygon.map(([x, y]) => [x + 8, y + 8] as Point)
                    }
                  : room
              )
            }
          : level
      )
    };

    const ctx = buildComplianceContext(tampered, rulePack, { buildingType: "healthcare" });
    const issue = runComplianceCheck(ctx).find(
      (item) => item.ruleId === "vertical_alignment" && item.status === "warning" && item.levelId === "level-01"
    );

    expect(issue).toBeDefined();
    expect(resolveComplianceFix(issue!)).toEqual({
      violationId: issue!.id,
      scope: "single_floor",
      affectedFloorIds: ["level-01"]
    });
  });

  it("derives copilot findings from compliance results without a separate alignment engine", () => {
    const ctx = buildComplianceContext(baseVersion, rulePack, { buildingType: "healthcare" });
    const findings = generateComplianceInsights(runComplianceCheck(ctx));

    expect(findings.every((finding) => finding.sub)).toBe(true);
    expect(findings.some((finding) => finding.actions?.length)).toBe(true);
  });

  it("computes riskCount from medium and high compliance warnings", () => {
    const ctx = buildComplianceContext(baseVersion, rulePack, { buildingType: "healthcare" });
    const results = runComplianceCheck(ctx);
    const riskCount = computeRiskCount(results, 1);

    expect(riskCount).toBeGreaterThan(0);
    expect(riskCount).toBe(results.filter((item) => item.status === "warning" && item.severity !== "low").length + 1);
  });

  it("keeps per-floor compliance rows with level metadata on multi-floor versions", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const ctx = buildComplianceContext(expanded, rulePack, { buildingType: "healthcare" });
    const results = runComplianceCheck(ctx);
    const egressRows = results.filter((item) => item.ruleId === "egress-distance");

    expect(egressRows.length).toBeGreaterThan(1);
    expect(egressRows.every((item) => item.levelId)).toBe(true);
    expect(egressRows.map((item) => item.levelId)).toEqual(
      expect.arrayContaining(["level-01", "level-02", "level-03", "level-04"])
    );
  });

  it("can still rollup per-floor compliance rows when requested", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const ctx = buildComplianceContext(expanded, rulePack, { buildingType: "healthcare" });
    const rolled = runComplianceCheck(ctx, { rollupPerFloor: true });

    expect(rolled.filter((item) => item.ruleId === "egress-distance")).toHaveLength(1);
    expect(rolled.find((item) => item.ruleId === "egress-distance")?.levelId).toBeUndefined();
  });

  it("keeps quantity-engine checkCompliance as a thin adapter", () => {
    const items = checkCompliance(baseVersion, defaultHealthcareCodeContext, rulePack, {
      buildingType: "healthcare"
    });
    const egressItem = items.find((item) => item.ruleId === "egress-distance");

    expect(items.length).toBeGreaterThan(0);
    expect(egressItem?.scope).toBe("per_floor");
    expect(egressItem?.message).toMatch(/egress path|door-corridor-stair|semantic/i);
  });
});
