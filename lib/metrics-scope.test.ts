import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { calculateScopedQuantities, metricsScopeOptions } from "@/lib/metrics-scope";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";

const baseVersion = initialProjectData.versions[0]!;

describe("metrics scope helpers", () => {
  it("exposes building, level, and floor group options for multi-floor versions", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const options = metricsScopeOptions(expanded, "level-02");

    expect(options.find((option) => option.scope === "building")?.enabled).toBe(true);
    expect(options.find((option) => option.scope === "level")?.enabled).toBe(true);
    expect(options.find((option) => option.scope === "floor_group")?.enabled).toBe(true);
  });

  it("calculates different gross areas per scope", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const building = calculateScopedQuantities(expanded, "building");
    const level = calculateScopedQuantities(expanded, "level", "level-01");
    const group = calculateScopedQuantities(expanded, "floor_group", "level-02");

    expect(building.summary.grossArea).toBeGreaterThan(level.summary.grossArea);
    expect(group.summary.grossArea).toBeGreaterThan(0);
    expect(group.summary.grossArea).toBeLessThan(building.summary.grossArea);
  });
});
