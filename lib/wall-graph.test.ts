import { describe, expect, it } from "vitest";
import {
  applyVertexDrag,
  applyWallDrag,
  deriveWallGraph,
  edgeKeyToWallId,
  pointsNear
} from "@/lib/wall-graph";
import type { Room } from "@/lib/project-types";

const livingRoom: Room = {
  id: "living",
  name: "Living",
  type: "living_room",
  zone: "public",
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

const bedroom: Room = {
  id: "bedroom",
  name: "Bedroom",
  type: "bedroom",
  zone: "private",
  polygon: [
    [10, 0],
    [20, 0],
    [20, 8],
    [10, 8]
  ],
  areaSqm: 80,
  ceilingHeight: 3,
  doors: [],
  windows: []
};

describe("wall graph", () => {
  it("merges shared edges between adjacent rooms", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const shared = graph.find((edge) => edge.roomIds.length === 2);

    expect(shared?.roomIds.sort()).toEqual(["bedroom", "living"]);
    expect(pointsNear(shared!.nodeA, [10, 0])).toBe(true);
    expect(pointsNear(shared!.nodeB, [10, 8])).toBe(true);
  });

  it("maps wall ids back to graph edges", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const shared = graph.find((edge) => edge.roomIds.length === 2)!;

    expect(shared.id).toBe(edgeKeyToWallId(shared.key));
  });

  it("moves shared wall vertices for both rooms", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const shared = graph.find((edge) => edge.roomIds.length === 2)!;
    const next = applyWallDrag([livingRoom, bedroom], shared.id, [1, 0]);

    const movedLiving = next.find((room) => room.id === "living")!;
    const movedBedroom = next.find((room) => room.id === "bedroom")!;

    expect(movedLiving.polygon[1][0]).toBeCloseTo(11, 3);
    expect(movedLiving.polygon[2][0]).toBeCloseTo(11, 3);
    expect(movedBedroom.polygon[0][0]).toBeCloseTo(11, 3);
    expect(movedBedroom.polygon[3][0]).toBeCloseTo(11, 3);
  });

  it("syncs a dragged vertex across all rooms", () => {
    const next = applyVertexDrag([livingRoom, bedroom], [10, 0], [10.5, 0.5]);
    const movedLiving = next.find((room) => room.id === "living")!;
    const movedBedroom = next.find((room) => room.id === "bedroom")!;

    expect(movedLiving.polygon[1]).toEqual([10.5, 0.5]);
    expect(movedBedroom.polygon[0]).toEqual([10.5, 0.5]);
  });
});
