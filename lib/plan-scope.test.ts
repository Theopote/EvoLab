import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { createIfcExportPayload } from "@/lib/ifc-export-contract";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { calculateQuantities, calculateQuantitiesByFloorGroup } from "@/lib/quantity-engine";
import { collectLevelValidationUnits, resolvePlanScope } from "@/lib/plan-scope";
import { validatePlanVersion } from "@/lib/plan-validation";

const baseVersion = initialProjectData.versions[0]!;

describe("plan scope resolver", () => {
  it("resolves building scope with all level rooms", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const scoped = resolvePlanScope(expanded, { scope: "building" });

    expect(scoped.scope).toBe("building");
    expect(scoped.rooms.length).toBeGreaterThan(expanded.levels[0]!.rooms.length);
    expect(scoped.levelIds).toHaveLength(4);
  });

  it("resolves floor_group scope from a member level", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const scoped = resolvePlanScope(expanded, { levelId: "level-02" });

    expect(scoped.scope).toBe("floor_group");
    expect(scoped.levelIds).toEqual(["level-02", "level-03"]);
    expect(scoped.rooms.length).toBeGreaterThan(0);
  });

  it("counts typical floor gross area once per physical level in building scope", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const level1 = calculateQuantities(expanded, { levelId: "level-01", scope: "level" });
    const building = calculateQuantities(expanded, { scope: "building" });

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
});

describe("multi-floor validation", () => {
  it("does not flag identical typical-floor footprints as cross-level overlap", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const overlapIssues = validatePlanVersion(expanded).issues.filter((issue) => issue.id === "room-overlap");

    expect(overlapIssues).toHaveLength(0);
  });

  it("validates each physical level independently", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const units = collectLevelValidationUnits(expanded);

    expect(units).toHaveLength(4);
    units.forEach((unit) => {
      expect(unit.rooms.length).toBeGreaterThan(0);
      expect(unit.outline.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe("ifc export scope", () => {
  it("exports resolved rooms for standard-floor member levels", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const payload = createIfcExportPayload(expanded);
    const typicalStorey = payload.storeys.find((storey) => storey.id === "level-02");

    expect(typicalStorey?.spaces.length).toBeGreaterThan(0);
  });
});
