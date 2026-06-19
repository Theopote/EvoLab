import { describe, expect, it } from "vitest";
import { bboxFromStrokes, enforceRegionLock, roomsInSelection } from "@/lib/region-lock";
import type { Room } from "@/lib/project-types";

const rooms: Room[] = [
  {
    id: "a",
    name: "A",
    type: "office",
    zone: "private",
    polygon: [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5]
    ],
    areaSqm: 25,
    ceilingHeight: 3,
    doors: [],
    windows: []
  },
  {
    id: "b",
    name: "B",
    type: "office",
    zone: "private",
    polygon: [
      [8, 0],
      [12, 0],
      [12, 5],
      [8, 5]
    ],
    areaSqm: 20,
    ceilingHeight: 3,
    doors: [],
    windows: []
  }
];

describe("region lock", () => {
  it("builds a bbox from inpaint strokes", () => {
    const bbox = bboxFromStrokes([
      [
        [1, 1],
        [4, 4]
      ]
    ]);

    expect(bbox).toEqual({
      minX: 0.5,
      minY: 0.5,
      maxX: 4.5,
      maxY: 4.5
    });
  });

  it("selects rooms intersecting the bbox", () => {
    const bbox = bboxFromStrokes([
      [
        [1, 1],
        [4, 4]
      ]
    ])!;

    expect([...roomsInSelection(rooms, bbox)]).toEqual(["a"]);
  });

  it("restores rooms outside the allowed set", () => {
    const aiModified: Room[] = [
      { ...rooms[0], name: "A changed", polygon: rooms[0].polygon.map(([x, y]) => [x + 1, y]) as Room["polygon"] },
      { ...rooms[1], name: "B changed" }
    ];

    const locked = enforceRegionLock(rooms, aiModified, new Set(["a"]));

    expect(locked[0].name).toBe("A changed");
    expect(locked[0].polygon[0][0]).toBeCloseTo(1, 3);
    expect(locked[1]).toEqual(rooms[1]);
  });
});
