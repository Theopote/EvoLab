import { describe, expect, it } from "vitest";
import { measurePolygonClearWidth } from "@/lib/rules/metrics/corridor-width";
import type { Point } from "@/lib/project-types";
import { resolveTypologyPack, resolveTypologyPackId } from "@/lib/typology/resolve";
import { canonicalizeAnalysisLayerId } from "@/lib/typology/analysis-layers";

describe("typology packs", () => {
  it("resolves healthcare aliases", () => {
    expect(resolveTypologyPackId("clinic")).toBe("healthcare");
    expect(resolveTypologyPack("hospital").id).toBe("healthcare");
  });

  it("resolves school from education alias", () => {
    expect(resolveTypologyPackId("education")).toBe("school");
    expect(resolveTypologyPack("education").flowDefinitions[0].layerId).toBe("primary_flow");
  });

  it("canonicalizes legacy analysis layer ids", () => {
    expect(canonicalizeAnalysisLayerId("patient_flow")).toBe("primary_flow");
    expect(canonicalizeAnalysisLayerId("clean_dirty_flow")).toBe("service_flow");
  });
});

describe("corridor clear width", () => {
  it("measures rectangular corridor width accurately", () => {
    const corridor: Point[] = [
      [0, 0],
      [20, 0],
      [20, 2.4],
      [0, 2.4]
    ];

    expect(measurePolygonClearWidth(corridor)).toBeCloseTo(2.4, 1);
  });

  it("detects narrow section in L-shaped corridor better than bbox", () => {
    const corridor: Point[] = [
      [0, 0],
      [20, 0],
      [20, 2],
      [2, 2],
      [2, 8],
      [0, 8]
    ];

    const clearWidth = measurePolygonClearWidth(corridor);
    expect(clearWidth).toBeLessThanOrEqual(2.05);
    expect(clearWidth).toBeGreaterThan(1.5);
  });
});
