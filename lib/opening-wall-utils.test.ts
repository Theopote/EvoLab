import { describe, expect, it } from "vitest";
import {
  openingCenterFromDragPoint,
  openingCenterFromPosition,
  openingFitsOnWall,
  openingPositionLimits,
  openingPositionOnWall,
  validateOpeningDraft
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

  it("projects drag points onto the wall with width limits", () => {
    const clamped = openingCenterFromDragPoint(wall, 1.2, [12, 4]);

    expect(clamped?.[0]).toBeCloseTo(8.9, 3);
    expect(clamped?.[1]).toBeCloseTo(0, 3);
    expect(openingCenterFromDragPoint(wall, 1.2, [5, 0])).toEqual([5, 0]);
  });

  it("validates vertical parameters", () => {
    expect(
      validateOpeningDraft({
        openingType: "window",
        wall,
        wallHeight: 3,
        width: 1.2,
        position: 0.5,
        height: 1.5,
        sillHeight: 0.9
      })
    ).toEqual({});

    expect(
      validateOpeningDraft({
        openingType: "door",
        wall,
        wallHeight: 3,
        width: 1.2,
        position: 0.5,
        height: 2.1,
        sillHeight: 0.5
      }).sillHeight
    ).toBe("doors use sill height 0");
  });
});
