import { describe, expect, it } from "vitest";
import {
  openingCenterFromPosition,
  openingFitsOnWall,
  openingPositionLimits,
  openingPositionOnWall
} from "@/lib/opening-wall-utils";
import type { OpeningElement, Wall } from "@/lib/project-types";

const wall: Wall = {
  id: "wall-01",
  start: [0, 0],
  end: [10, 0],
  thickness: 0.2,
  height: 3,
  type: "external",
  roomIds: ["room-01"]
};

const opening: OpeningElement = {
  id: "door-01",
  wallId: "wall-01",
  type: "door",
  center: [5, 0],
  width: 1.2,
  height: 2.1
};

describe("opening wall parameters", () => {
  it("reads and writes position along wall", () => {
    expect(openingPositionOnWall(opening, wall)).toBeCloseTo(0.5, 3);
    expect(openingCenterFromPosition(wall, 0.25)).toEqual([2.5, 0]);
  });

  it("computes valid position limits for width", () => {
    const limits = openingPositionLimits(wall, 1.2);

    expect(limits?.min).toBeCloseTo(0.11, 3);
    expect(limits?.max).toBeCloseTo(0.89, 3);
  });

  it("rejects openings wider than the wall", () => {
    expect(openingPositionLimits(wall, 10)).toBeUndefined();
    expect(openingFitsOnWall(wall, 10, 0.5)).toBe(false);
  });

  it("accepts centered openings that fit", () => {
    expect(openingFitsOnWall(wall, 1.2, 0.5)).toBe(true);
    expect(openingFitsOnWall(wall, 1.2, 0.02)).toBe(false);
  });
});
