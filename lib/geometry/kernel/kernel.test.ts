import { describe, expect, it } from "vitest";
import {
  geometryArea,
  intersectPolygons,
  intersectionArea,
  isPolygonInside,
  outsideArea,
  pointInPolygon,
  polygonArea,
  simplifyPolygon,
  subtractPolygons,
  unitePolygons
} from "@/lib/geometry/kernel";

const unitSquare: [number, number][] = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4]
];

const offsetSquare: [number, number][] = [
  [2, 2],
  [6, 2],
  [6, 6],
  [2, 6]
];

describe("geometry kernel", () => {
  it("measures polygon and geometry area", () => {
    expect(polygonArea(unitSquare)).toBe(16);
    expect(geometryArea(null)).toBe(0);
  });

  it("detects containment and overlap area", () => {
    expect(isPolygonInside(offsetSquare, unitSquare)).toBe(false);
    expect(isPolygonInside([[1, 1], [2, 1], [2, 2], [1, 2]], unitSquare)).toBe(true);
    expect(intersectionArea(unitSquare, offsetSquare)).toBe(4);
    expect(outsideArea(offsetSquare, unitSquare)).toBeGreaterThan(0);
  });

  it("runs boolean polygon operations", () => {
    const united = unitePolygons(unitSquare, offsetSquare);
    expect(united.length).toBeGreaterThan(0);
    expect(polygonArea(united[0]!)).toBeGreaterThan(16);

    const intersection = intersectPolygons(unitSquare, offsetSquare);
    expect(intersection).toHaveLength(1);
    expect(polygonArea(intersection[0]!)).toBe(4);

    const difference = subtractPolygons(offsetSquare, unitSquare);
    expect(difference).toHaveLength(1);
    expect(polygonArea(difference[0]!)).toBe(12);
  });

  it("tests point inclusion and simplifies polygons", () => {
    expect(pointInPolygon([2, 2], unitSquare)).toBe(true);
    expect(pointInPolygon([5, 5], unitSquare)).toBe(false);

    const noisy: [number, number][] = [
      [0, 0],
      [4.01, 0],
      [4, 4],
      [0, 3.99]
    ];
    const simplified = simplifyPolygon(noisy, 0.05);

    expect(simplified.length).toBeGreaterThanOrEqual(3);
    expect(polygonArea(simplified)).toBeCloseTo(16, 0);
  });

  it("keeps legacy shim exports compatible", async () => {
    const polygonOps = await import("@/lib/polygon-ops");
    const geometryKernel = await import("@/lib/geometry-kernel");

    expect(polygonOps.polygonArea(unitSquare)).toBe(16);
    expect(geometryKernel.unitePolygons(unitSquare, offsetSquare).length).toBeGreaterThan(0);
    expect(geometryKernel.pointInPolygon([2, 2], unitSquare)).toBe(true);
  });
});
