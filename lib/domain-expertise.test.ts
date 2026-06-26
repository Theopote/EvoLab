import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { computeWallAreaWithOpeningDeductions } from "@/lib/quantity/opening-deductions";
import { estimateStructuralQuantities } from "@/lib/quantity/structural-quantities";
import { calculateQuantities, buildComplianceReport } from "@/lib/quantity-engine";
import { resolveMeasurementRuleSet } from "@/lib/quantity/measurement-standards";
import { sizeMepLayout } from "@/lib/mep/mep-sizing";
import { routeMepLayout } from "@/lib/mep-router";
import type { OpeningElement, Wall } from "@/lib/project-types";

describe("domain expertise enhancements", () => {
  const version = initialProjectData.versions[0]!;

  it("deducts opening area from gross wall area", () => {
    const walls: Wall[] = [
      {
        id: "wall-1",
        start: [0, 0],
        end: [10, 0],
        thickness: 0.2,
        height: 3,
        type: "external",
        roomIds: ["room-1"]
      }
    ];
    const openings: OpeningElement[] = [
      {
        id: "door-1",
        wallId: "wall-1",
        type: "door",
        center: [2, 0],
        width: 1,
        height: 2.1,
        roomIds: ["room-1"]
      }
    ];

    const breakdown = computeWallAreaWithOpeningDeductions(walls, openings);

    expect(breakdown.grossWallArea).toBe(30);
    expect(breakdown.openingDeductionArea).toBe(2.1);
    expect(breakdown.netWallArea).toBe(27.9);
  });

  it("adds structural quantity rows at building scope", () => {
    const quantities = calculateQuantities(version, { scope: "building", measurementStandard: "gb50300" });

    expect(quantities.summary.structural?.totalConcreteM3).toBeGreaterThan(0);
    expect(quantities.rows.some((row) => row.id === "concrete-volume")).toBe(true);
    expect(quantities.rows.some((row) => row.classification?.standardId === "gb50300")).toBe(true);
  });

  it("classifies quantities under multiple measurement standards", () => {
    const gb = resolveMeasurementRuleSet("gb50300").classify("gross-area");
    const uniformat = resolveMeasurementRuleSet("uniformat").classify("gross-area");

    expect(gb?.code).toBe("010101");
    expect(uniformat?.code).toBe("A10");
  });

  it("generates china compliance report with clause references", () => {
    const report = buildComplianceReport(version, { buildingType: "healthcare", region: "CN" });

    expect(report.region).toBe("CN");
    expect(report.items.length).toBeGreaterThan(0);
    expect(report.items.some((item) => item.code.includes("GB"))).toBe(true);
    expect(report.narrativeSummary.length).toBeGreaterThan(0);
  });

  it("sizes MEP routes with pipe diameter and equipment selection", () => {
    const mep = routeMepLayout(version);
    const sizing = sizeMepLayout(version, mep);

    expect(sizing.pipeSizing.length).toBeGreaterThan(0);
    expect(sizing.pipeSizing[0]?.diameterMm).toBeGreaterThan(0);
    expect(sizing.hvacLoad.peakLoadKw).toBeGreaterThan(0);
    expect(sizing.equipment.fanCoil).toBeDefined();
  });

  it("estimates structural quantities from grid columns", () => {
    const structural = estimateStructuralQuantities(version);

    expect(structural.totalConcreteM3).toBeGreaterThan(0);
    expect(structural.rebarWeightKg).toBeGreaterThan(0);
  });
});
