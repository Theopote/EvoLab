import { describe, expect, it } from "vitest";
import { buildBoundarySpan, spanVertexIndices } from "@/lib/boundary-span-select";
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

describe("boundary-span-select", () => {
  it("builds a span with locked anchors around a corner", () => {
    const span = buildBoundarySpan(room, 1, 2);

    expect(span).toBeDefined();
    expect(span?.anchorBefore).toEqual([0, 0]);
    expect(span?.anchorAfter).toEqual([0, 8]);
    expect(span?.currentPoints).toEqual([
      [10, 0],
      [10, 8]
    ]);
  });

  it("uses the shorter arc by default", () => {
    const short = spanVertexIndices(4, 0, 1, false);
    const long = spanVertexIndices(4, 0, 1, true);

    expect(short).toEqual([0, 1]);
    expect(long.length).toBeGreaterThan(short.length);
  });
});
