import { describe, expect, it } from "vitest";
import { addProtrusion, buildBayWindowFootprint } from "@/lib/add-protrusion";
import { evaluateBayWindowGfaExempt } from "@/lib/gfa-exemption";
import type { Room, Wall } from "@/lib/project-types";

const room: Room = {
  id: "living",
  name: "Living",
  type: "living_room",
  zone: "private",
  polygon: [
    [0, 0],
    [10, 0],
    [10, 8],
    [0, 8]
  ],
  areaSqm: 80,
  ceilingHeight: 3,
  doors: [],
  windows: []
};

const wall: Wall = {
  id: "wall-north",
  start: [0, 0],
  end: [10, 0],
  thickness: 0.2,
  height: 3,
  type: "external",
  roomIds: ["living"]
};

describe("add-protrusion", () => {
  it("builds an outward bay-window footprint", () => {
    const footprint = buildBayWindowFootprint(wall, 0.5, 1.5, 0.45, room.polygon);

    expect(footprint.length).toBeGreaterThanOrEqual(4);
    expect(footprint.some(([x, y]) => y < 0)).toBe(true);
  });

  it("unions protrusion area into the host room", () => {
    const footprint = buildBayWindowFootprint(wall, 0.5, 1.5, 0.45, room.polygon);
    const next = addProtrusion(
      room,
      {
        id: "bay-1",
        type: "bay_window",
        footprint,
        depthM: 0.45,
        sillHeightM: 0.9
      },
      [
        [-2, -2],
        [12, -2],
        [12, 10],
        [-2, 10]
      ],
      {
        maxDepthM: 0.6,
        minSillHeightM: 0.45,
        minHeadroomM: 2.2,
        notice: "verify local code"
      }
    );

    expect(next?.areaSqm).toBeGreaterThan(room.areaSqm);
    expect(next?.protrusions?.[0]?.gfaExempt).toBe(true);
  });

  it("marks deep bay windows as GFA-counted under thresholds", () => {
    const result = evaluateBayWindowGfaExempt({
      id: "bay-1",
      type: "bay_window",
      footprint: [],
      depthM: 0.9,
      sillHeightM: 0.9
    });

    expect(result.exempt).toBe(false);
  });
});
