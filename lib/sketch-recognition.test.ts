import { describe, expect, it } from "vitest";
import type { GhostLoop } from "@/lib/sketch-input-store";
import { ghostLoopsSignature, matchSemanticRoomsToGhostLoops } from "@/lib/sketch-recognition";

describe("sketch-recognition", () => {
  it("builds a stable signature for ghost loops", () => {
    const loops: GhostLoop[] = [
      {
        id: "ghost-a",
        polygon: [
          [1, 1],
          [4, 1],
          [4, 3],
          [1, 3]
        ],
        areaSqm: 6
      },
      {
        id: "ghost-b",
        polygon: [
          [5, 1],
          [8, 1],
          [8, 3],
          [5, 3]
        ],
        areaSqm: 6
      }
    ];

    expect(ghostLoopsSignature(loops)).toBe("ghost-a|ghost-b");
  });

  it("matches recognized rooms to ghost loops by centroid proximity", () => {
    const loops: GhostLoop[] = [
      {
        id: "ghost-a",
        polygon: [
          [0, 0],
          [4, 0],
          [4, 3],
          [0, 3]
        ],
        areaSqm: 12
      }
    ];

    const assignments = matchSemanticRoomsToGhostLoops(loops, [
      {
        room: {
          id: "sketch-room-1",
          name: "Bedroom",
          type: "bedroom",
          zone: "private",
          polygon: [
            [0.2, 0.2],
            [3.8, 0.2],
            [3.8, 2.8],
            [0.2, 2.8]
          ],
          areaSqm: 12,
          ceilingHeight: 3
        },
        confidence: "high"
      }
    ]);

    expect(assignments["ghost-a"]?.room.name).toBe("Bedroom");
  });
});
