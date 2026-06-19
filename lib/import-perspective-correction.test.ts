import { describe, expect, it } from "vitest";
import {
  computeDestinationToSourceHomography,
  estimatePerspectiveOutputSize,
  mapPointWithHomography
} from "@/lib/import-perspective-correction";
import { defaultPerspectiveQuad, type PerspectiveQuad } from "@/lib/import-image-utils";

describe("import perspective correction", () => {
  it("estimates output size from opposing edge lengths", () => {
    const quad: PerspectiveQuad = [
      [0, 0],
      [100, 0],
      [90, 80],
      [10, 80]
    ];

    expect(estimatePerspectiveOutputSize(quad)).toEqual({
      width: 95,
      height: 80
    });
  });

  it("maps destination corners back to the source quad", () => {
    const sourceQuad: PerspectiveQuad = [
      [20, 30],
      [420, 40],
      [400, 320],
      [30, 310]
    ];
    const output = estimatePerspectiveOutputSize(sourceQuad);
    const homography = computeDestinationToSourceHomography(sourceQuad, output.width, output.height);

    const mappedCorners = [
      mapPointWithHomography(homography, [0, 0]),
      mapPointWithHomography(homography, [output.width, 0]),
      mapPointWithHomography(homography, [output.width, output.height]),
      mapPointWithHomography(homography, [0, output.height])
    ];

    mappedCorners.forEach((point, index) => {
      const expected = sourceQuad[index];
      expect(point[0]).toBeCloseTo(expected[0], 3);
      expect(point[1]).toBeCloseTo(expected[1], 3);
    });
  });

  it("keeps an axis-aligned source quad near identity", () => {
    const sourceQuad = defaultPerspectiveQuad(0);
    const pixelQuad: PerspectiveQuad = [
      [0, 0],
      [200, 0],
      [200, 100],
      [0, 100]
    ];
    const homography = computeDestinationToSourceHomography(pixelQuad, 200, 100);
    const center = mapPointWithHomography(homography, [100, 50]);

    expect(center[0]).toBeCloseTo(100, 2);
    expect(center[1]).toBeCloseTo(50, 2);
    expect(sourceQuad[0][0]).toBe(0);
  });
});
