import { describe, expect, it } from "vitest";
import { applyBoundaryReshape, mockArcPoints, verifyAnchorsLocked } from "@/lib/reshape-boundary";
import { buildBoundarySpan } from "@/lib/boundary-span-select";
import type { Room } from "@/lib/project-types";

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

describe("reshape-boundary", () => {
  it("forces anchor endpoints back into place", () => {
    const span = buildBoundarySpan(room, 1, 2)!;
    const fixed = verifyAnchorsLocked(
      [
        [99, 99],
        [10, 4],
        [1, 1]
      ],
      span
    );

    expect(fixed[0]).toEqual(span.anchorBefore);
    expect(fixed[fixed.length - 1]).toEqual(span.anchorAfter);
  });

  it("replaces only the selected span vertices", () => {
    const span = buildBoundarySpan(room, 1, 2)!;
    const curve = mockArcPoints(span, 6);
    const reshaped = applyBoundaryReshape(room, span, curve);

    expect(reshaped.polygon.length).toBeGreaterThan(room.polygon.length);
    expect(reshaped.areaSqm).not.toBe(room.areaSqm);
  });
});
