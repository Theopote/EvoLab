import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { generateRuleBasedMep, routeMepLayout, routesForLevel } from "@/lib/mep-router";

const baseVersion = initialProjectData.versions[0]!;
const SYSTEM_COUNT = 6;

describe("routeMepLayout", () => {
  it("routes all six MEP systems on a single-floor plan", () => {
    const mep = routeMepLayout(baseVersion);

    expect(mep.shafts.length).toBeGreaterThan(0);
    expect(mep.routes).toHaveLength(SYSTEM_COUNT);
    expect(new Set(mep.routes.map((route) => route.system)).size).toBe(SYSTEM_COUNT);
  });

  it("keeps route paths inside the plan outline", () => {
    const mep = routeMepLayout(baseVersion);
    const { width, height } = baseVersion.overallBounds;

    for (const route of mep.routes) {
      expect(route.path.length).toBeGreaterThanOrEqual(2);
      for (const [x, y] of route.path) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(width);
        expect(y).toBeLessThanOrEqual(height);
      }
    }
  });

  it("connects each route to at least one room", () => {
    const mep = routeMepLayout(baseVersion);

    for (const route of mep.routes) {
      expect(route.connectsRoomIds.length).toBeGreaterThan(0);
    }
  });

  it("shares one riser stack across multi-floor versions", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const mep = routeMepLayout(expanded);

    expect(mep.shafts[0]?.levelIds).toEqual(["level-01", "level-02", "level-03", "level-04"]);
    expect(mep.routes.filter((route) => route.levelId === "level-02")).toHaveLength(SYSTEM_COUNT);
    expect(mep.routes).toHaveLength(SYSTEM_COUNT * expanded.levels.length);
  });

  it("filters routes by level id", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const mep = routeMepLayout(expanded);
    const levelRoutes = routesForLevel(mep, "level-03");

    expect(levelRoutes).toHaveLength(SYSTEM_COUNT);
    expect(levelRoutes.every((route) => !route.levelId || route.levelId === "level-03")).toBe(true);
  });
});

describe("generateRuleBasedMep", () => {
  it("returns schema-compatible findings for multi-floor routing", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const result = generateRuleBasedMep(expanded);

    expect(result.mep.routes.length).toBe(SYSTEM_COUNT * expanded.levels.length);
    expect(result.findings.some((finding) => finding.id === "mep-routing")).toBe(true);
    expect(result.findings.some((finding) => finding.id === "mep-plumbing")).toBe(true);
  });
});
