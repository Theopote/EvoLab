import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { clampPerspectiveQuad } from "@/lib/import-image-utils";
import { buildVersionWallPreviewDataUrl } from "@/lib/import-reference-preview";

describe("import reference preview", () => {
  it("builds an svg data url from wall geometry", () => {
    const preview = buildVersionWallPreviewDataUrl(initialProjectData.versions[0]);

    expect(preview.startsWith("data:image/svg+xml;base64,")).toBe(true);
    expect(preview.length).toBeGreaterThan(100);
  });
});

describe("clampPerspectiveQuad", () => {
  it("clamps corner coordinates into the unit square", () => {
    const clamped = clampPerspectiveQuad([
      [-0.1, 0.2],
      [1.2, 0.1],
      [0.9, 1.4],
      [0.05, 0.95]
    ]);

    expect(clamped).toEqual([
      [0, 0.2],
      [1, 0.1],
      [0.9, 1],
      [0.05, 0.95]
    ]);
  });
});
