import { describe, expect, it } from "vitest";
import { buildFacadeSegmentOverlays, classifyOutlineEdge, windowSlotsAlongSegment } from "@/lib/viewer-3d/facade-envelope";

describe("facade-envelope", () => {
  const outline = [
    [0, 0],
    [20, 0],
    [20, 12],
    [0, 12]
  ] as Array<[number, number]>;

  it("classifies outline edges by cardinal direction", () => {
    expect(classifyOutlineEdge([0, 0], [20, 0], [10, 6])).toBe("south");
    expect(classifyOutlineEdge([20, 0], [20, 12], [10, 6])).toBe("east");
    expect(classifyOutlineEdge([20, 12], [0, 12], [10, 6])).toBe("north");
    expect(classifyOutlineEdge([0, 12], [0, 0], [10, 6])).toBe("west");
  });

  it("builds facade overlays from domain zones", () => {
    const overlays = buildFacadeSegmentOverlays({
      outline,
      levelId: "level-01",
      facade: {
        id: "facade-01",
        defaultWindowRatio: 0.35,
        zones: [
          {
            id: "z-south",
            levelId: "level-01",
            edge: "south",
            strategy: "curtain_wall",
            targetWindowRatio: 0.5
          }
        ]
      }
    });

    expect(overlays).toHaveLength(4);
    expect(overlays.find((item) => item.edge === "south")?.strategy).toBe("curtain_wall");
  });

  it("derives window slot count from ratio", () => {
    const slots = windowSlotsAlongSegment(12, 0.4, 1.5);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]?.width).toBeGreaterThan(0);
  });
});
