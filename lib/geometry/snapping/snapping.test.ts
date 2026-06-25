import { describe, expect, it } from "vitest";
import { constrainOrthoDelta, pointsNear, snapPoint } from "@/lib/geometry/snapping";

describe("geometry snapping", () => {
  it("snaps to grid and nearby endpoints", () => {
    expect(snapPoint([1.04, 2.06], { gridStep: 0.1 })).toEqual([1, 2.1]);
    expect(
      snapPoint([1.02, 2.02], {
        gridEnabled: false,
        endpointTargets: [[1, 2]],
        endpointTolerance: 0.1
      })
    ).toEqual([1, 2]);
  });

  it("clusters nearby points and constrains ortho deltas", () => {
    expect(pointsNear([0, 0], [0.04, 0], 0.05)).toBe(true);
    expect(constrainOrthoDelta([0, 0], [3, 0.2], 8)).toEqual([3, 0]);
    expect(constrainOrthoDelta([0, 0], [0.2, 3], 8)).toEqual([0, 3]);
  });
});
