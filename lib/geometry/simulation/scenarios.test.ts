import { describe, expect, it } from "vitest";
import {
  runGeometryCoreSimulations,
  summarizeGeometrySimulations
} from "@/lib/geometry/simulation/scenarios";

describe("geometry core simulation", () => {
  it("runs end-to-end geometry core scenarios", () => {
    const summary = summarizeGeometrySimulations();

    expect(summary.total).toBe(6);
    expect(summary.passed).toBe(6);
    expect(summary.failed).toEqual([]);

    summary.reports.forEach((report) => {
      expect(report.steps.length).toBeGreaterThan(0);
      expect(report.steps.every((item) => item.ok)).toBe(true);
    });
  });

  it("exposes individual scenario reports for debugging", () => {
    const reports = runGeometryCoreSimulations();
    const scenarios = reports.map((report) => report.scenario);

    expect(scenarios).toEqual([
      "snapping-and-ortho",
      "room-split-merge",
      "wall-drag-clamp",
      "gap-overlap-validation",
      "setback-inset",
      "authoritative-export"
    ]);
  });
});
