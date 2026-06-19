import { describe, expect, it } from "vitest";
import {
  closeStrokePolygon,
  detectClosedLoops,
  isClosedStroke,
  processSketchStrokes,
  regularizeAngles,
  simplifyStroke,
  strokeToSegments
} from "@/lib/sketch-processing";

describe("sketch-processing", () => {
  it("simplifies jittery strokes while keeping corners", () => {
    const jittery = [
      [0, 0],
      [0.01, 0.02],
      [0, 4],
      [5.01, 4.01],
      [5, 0],
      [0.01, 0]
    ] as const;

    const simplified = simplifyStroke([...jittery], 0.05);

    expect(simplified.length).toBeLessThan(jittery.length);
    expect(simplified[0]).toEqual([0, 0]);
    expect(simplified[simplified.length - 1]).toEqual([0.01, 0]);
  });

  it("snaps near-orthogonal segments to exact right angles", () => {
    const segments = regularizeAngles(
      [
        { start: [0, 0], end: [4.05, 0.1] },
        { start: [4.05, 0.1], end: [4.05, 3.95] }
      ],
      8
    );

    expect(segments[0].end[1]).toBeCloseTo(0, 5);
    expect(segments[1].end[0]).toBeCloseTo(segments[0].end[0], 5);
  });

  it("detects a closed rectangular stroke as a room polygon", () => {
    const stroke = [
      [2, 2],
      [8, 2.05],
      [8.05, 6],
      [2, 6],
      [2.05, 2]
    ];

    expect(isClosedStroke(stroke)).toBe(true);

    const polygon = closeStrokePolygon(stroke);

    expect(polygon.length).toBeGreaterThanOrEqual(4);
    expect(polygon[0][0]).toBeCloseTo(2, 0);
    expect(polygon[1][0]).toBeGreaterThan(polygon[0][0]);
  });

  it("finds closed loops across multiple wall strokes", () => {
    const segments = strokeToSegments([
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4],
      [0, 0]
    ]);
    const loops = detectClosedLoops(segments);

    expect(loops.length).toBeGreaterThan(0);
    expect(loops[0].length).toBeGreaterThanOrEqual(4);
  });

  it("processes multiple sketch strokes into candidate room loops", () => {
    const loops = processSketchStrokes([
      [
        [1, 1],
        [5, 1],
        [5, 4],
        [1, 4],
        [1, 1]
      ],
      [
        [5, 1],
        [9, 1],
        [9, 4],
        [5, 4],
        [5, 1]
      ]
    ]);

    expect(loops.length).toBeGreaterThanOrEqual(1);
    expect(loops[0]?.areaSqm).toBeGreaterThan(1.5);
  });
});
