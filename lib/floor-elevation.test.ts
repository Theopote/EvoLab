import { describe, expect, it } from "vitest";
import { applyComputedElevations, computeLevelElevations } from "@/lib/floor-elevation";
import type { Level } from "@/lib/project-types";

function level(id: string, floorNumber: number, height: number): Level {
  return {
    id,
    name: id,
    floorNumber,
    elevation: 0,
    height,
    rooms: [],
    walls: [],
    openings: []
  };
}

describe("floor-elevation", () => {
  it("computes elevations from ground upward", () => {
    const elevations = computeLevelElevations([
      level("b1", -1, 3),
      level("l1", 1, 4),
      level("l2", 2, 3.6),
      level("l3", 3, 3.6)
    ]);

    expect(elevations.get("b1")).toBe(-3);
    expect(elevations.get("l1")).toBe(0);
    expect(elevations.get("l2")).toBe(4);
    expect(elevations.get("l3")).toBe(7.6);
  });

  it("writes computed elevations back onto levels", () => {
    const levels = applyComputedElevations([level("l1", 1, 3.6), level("l2", 2, 3.6)]);

    expect(levels[0]?.elevation).toBe(0);
    expect(levels[1]?.elevation).toBe(3.6);
  });
});
