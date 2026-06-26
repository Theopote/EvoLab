import { describe, expect, it } from "vitest";
import { depthRgbaToGrayscale } from "@/lib/presentation/depth-map";
import { buildRenderCaptureView, slugifyCameraView } from "@/lib/presentation/render-capture-views";

describe("render-capture-views", () => {
  it("maps render brief camera presets to capture positions", () => {
    const view = buildRenderCaptureView("Entrance eye-level", 40);

    expect(view.position[1]).toBeGreaterThan(0);
    expect(view.target[1]).toBeGreaterThan(0);
    expect(view.position[2]).toBeGreaterThan(view.target[2]);
  });

  it("falls back to axonometric for unknown presets", () => {
    const fallback = buildRenderCaptureView("Unknown", 24);
    const axon = buildRenderCaptureView("Aerial axonometric", 24);

    expect(fallback).toEqual(axon);
  });

  it("slugifies camera labels for filenames", () => {
    expect(slugifyCameraView("South facade")).toBe("south-facade");
  });
});

describe("depth-map", () => {
  it("normalizes depth buffers with nearer surfaces brighter", () => {
    const rgba = new Uint8Array([
      40, 0, 0, 255,
      200, 0, 0, 255
    ]);
    const grayscale = depthRgbaToGrayscale(rgba, 2, 1);

    expect(grayscale[0]).toBeGreaterThan(grayscale[1]);
  });
});
