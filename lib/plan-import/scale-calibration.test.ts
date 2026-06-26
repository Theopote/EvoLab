import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import {
  applyScaleCalibration,
  calibrationScaleFactor,
  distancePlanUnits,
  scalePlanVersion
} from "@/lib/plan-import/scale-calibration";

describe("scale-calibration", () => {
  const version = initialProjectData.versions[0]!;

  it("computes distance between plan points", () => {
    expect(distancePlanUnits([0, 0], [3, 4])).toBe(5);
  });

  it("derives scale factor from reference length", () => {
    expect(calibrationScaleFactor(10, 5)).toBe(0.5);
    expect(calibrationScaleFactor(5, 10)).toBe(2);
  });

  it("scales geometry uniformly", () => {
    const scaled = scalePlanVersion(version, 2);
    expect(scaled.outline[1]?.[0]).toBeCloseTo((version.outline[1]?.[0] ?? 0) * 2, 4);
    expect(scaled.rooms[0]?.polygon[1]?.[0]).toBeCloseTo((version.rooms[0]?.polygon[1]?.[0] ?? 0) * 2, 4);
  });

  it("applies two-point calibration", () => {
    const calibrated = applyScaleCalibration(version, [0, 0], [10, 0], 5);
    expect(calibrated.outline[1]?.[0]).toBeCloseTo(36, 1);
  });
});
