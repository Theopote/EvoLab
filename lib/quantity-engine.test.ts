import { describe, expect, it } from "vitest";
import { defaultHealthcareCodeContext } from "@/lib/building-domain";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import {
  buildComplianceReport,
  calculateQuantities,
  calculateQuantitiesByFloorGroup,
  checkCompliance
} from "@/lib/quantity-engine";
import { resolveRulePack } from "@/lib/rules/rule-pack";

const baseVersion = initialProjectData.versions[0]!;
const rulePack = resolveRulePack({ codeContext: defaultHealthcareCodeContext, projectType: "healthcare" });

describe("calculateQuantities", () => {
  it("returns positive gross and net areas for the seed demo scheme", () => {
    const quantities = calculateQuantities(baseVersion, { scope: "building" });

    expect(quantities.summary.grossArea).toBe(2746);
    expect(quantities.summary.netUsableArea).toBe(2232);
    expect(quantities.summary.grossArea).toBeGreaterThan(quantities.summary.netUsableArea);
  });

  it("deducts openings from gross wall area at building scope", () => {
    const quantities = calculateQuantities(baseVersion, { scope: "building" });

    expect(quantities.summary.wallAreaGross).toBe(1975.4);
    expect(quantities.summary.openingDeductionArea).toBe(62.6);
    expect(quantities.summary.wallAreaNet).toBe(1912.8);
    expect(quantities.summary.wallArea).toBe(quantities.summary.wallAreaNet);
  });

  it("includes structural rows only at building scope", () => {
    const building = calculateQuantities(baseVersion, { scope: "building" });
    const level = calculateQuantities(baseVersion, { levelId: baseVersion.levels[0]?.id, scope: "level" });

    expect(building.summary.structural?.totalConcreteM3).toBeGreaterThan(0);
    expect(building.rows.some((row) => row.id === "concrete-volume")).toBe(true);
    expect(level.summary.structural).toBeUndefined();
    expect(level.rows.some((row) => row.id === "concrete-volume")).toBe(false);
  });

  it("counts typical floor gross area once per physical level in building scope", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const level1 = calculateQuantities(expanded, { levelId: "level-01", scope: "level" });
    const building = calculateQuantities(expanded, { scope: "building" });

    expect(building.summary.grossArea).toBe(10984);
    expect(building.summary.grossArea).toBeGreaterThan(level1.summary.grossArea);
  });

  it("exposes per-floor-group quantities without double counting members", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const byGroup = calculateQuantitiesByFloorGroup(expanded);
    const groupId = expanded.standardFloorGroups?.[0]?.id;

    expect(groupId).toBeTruthy();
    expect(byGroup[groupId!]?.summary.grossArea).toBeGreaterThan(0);
    expect(byGroup[groupId!]?.summary.grossArea).toBeLessThan(
      calculateQuantities(expanded, { scope: "building" }).summary.grossArea
    );
  });

  it("classifies rows under the selected measurement standard", () => {
    const quantities = calculateQuantities(baseVersion, { scope: "building", measurementStandard: "gb50300" });
    const grossRow = quantities.rows.find((row) => row.id === "gross-area");

    expect(grossRow?.classification?.standardId).toBe("gb50300");
    expect(grossRow?.classification?.code).toBe("010101");
  });
});

describe("checkCompliance", () => {
  it("returns unique compliance items for multi-floor versions", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const items = checkCompliance(expanded, defaultHealthcareCodeContext, rulePack, { buildingType: "healthcare" });

    expect(items.length).toBeGreaterThan(0);
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
  });
});

describe("buildComplianceReport", () => {
  it("generates a china compliance report with clause references", () => {
    const report = buildComplianceReport(baseVersion, { buildingType: "healthcare", region: "CN" });

    expect(report.region).toBe("CN");
    expect(report.items.length).toBeGreaterThan(0);
    expect(report.items.some((item) => item.code.includes("GB"))).toBe(true);
    expect(report.narrativeSummary.length).toBeGreaterThan(0);
  });
});
