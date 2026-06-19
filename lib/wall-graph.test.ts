import { describe, expect, it } from "vitest";
import {
  applyNodeDrag,
  applyNodeMove,
  applyVertexDrag,
  applyWallDrag,
  applyWallDragByOffset,
  clampWallDragOffset,
  deriveWallGraph,
  edgeKeyToWallIdFromKey,
  findWallEdge,
  hitTestWalls,
  pointsNear,
  roomsAtNode
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
    const shared = graph.edges.find((edge) => edge.roomIds.length === 2);

    expect(shared?.roomIds.sort()).toEqual(["bedroom", "living"]);
    expect(shared?.roomSides).toHaveLength(2);
    expect(pointsNear(shared!.nodeA, [10, 0])).toBe(true);
    expect(pointsNear(shared!.nodeB, [10, 8])).toBe(true);
  });

  it("maps wall ids back to graph edges", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const shared = graph.edges.find((edge) => edge.roomIds.length === 2)!;

    expect(shared.id).toBe(edgeKeyToWallIdFromKey(shared.key));
  });

  it("moves shared wall vertices for both rooms", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const shared = graph.edges.find((edge) => edge.roomIds.length === 2)!;
    const next = applyWallDrag([livingRoom, bedroom], shared.id, [1, 0]);

    const movedLiving = next.find((room) => room.id === "living")!;
    const movedBedroom = next.find((room) => room.id === "bedroom")!;

    expect(movedLiving.polygon[1][0]).toBeCloseTo(11, 3);
    expect(movedLiving.polygon[2][0]).toBeCloseTo(11, 3);
    expect(movedBedroom.polygon[0][0]).toBeCloseTo(11, 3);
    expect(movedBedroom.polygon[3][0]).toBeCloseTo(11, 3);
  });

  it("syncs a dragged vertex across all rooms", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const sharedNode = graph.nodes.find((node) => pointsNear(node.position, [10, 0]))!;
    const next = applyNodeDrag([livingRoom, bedroom], graph, sharedNode.id, [10.5, 0.5]);
    const movedLiving = next.find((room) => room.id === "living")!;
    const movedBedroom = next.find((room) => room.id === "bedroom")!;

    expect(movedLiving.polygon[1]).toEqual([10.5, 0.5]);
    expect(movedBedroom.polygon[0]).toEqual([10.5, 0.5]);
  });

  it("keeps applyVertexDrag compatible with node drag", () => {
    const next = applyVertexDrag([livingRoom, bedroom], [10, 0], [10.5, 0.5]);
    const movedLiving = next.find((room) => room.id === "living")!;
    const movedBedroom = next.find((room) => room.id === "bedroom")!;

    expect(movedLiving.polygon[1]).toEqual([10.5, 0.5]);
    expect(movedBedroom.polygon[0]).toEqual([10.5, 0.5]);
  });

  it("preserves untouched room references during node move", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const shared = findWallEdge(graph.edges, graph.edges.find((edge) => edge.roomIds.length === 2)!.id)!;
    const next = applyNodeMove([livingRoom, bedroom], shared, [11, 0], [11, 8]);

    expect(next.find((room) => room.id === "living")).not.toBe(livingRoom);
    expect(next.find((room) => room.id === "bedroom")).not.toBe(bedroom);
  });

  it("identifies shared nodes across rooms", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const sharedNode = graph.nodes.find((node) => pointsNear(node.position, [10, 0]))!;

    expect(roomsAtNode(graph, sharedNode.id).sort()).toEqual(["bedroom", "living"]);
  });

  it("clamps wall drag to minimum room width", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const shared = graph.edges.find((edge) => edge.roomIds.length === 2)!;
    const normal: [number, number] = [1, 0];
    const clamped = clampWallDragOffset(9.8, [livingRoom, bedroom], shared, normal, 0.6);

    expect(clamped).toBeLessThan(9.8);
    expect(clamped).toBeGreaterThan(9);
  });

  it("applies clamped wall drag offsets from original rooms", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const shared = graph.edges.find((edge) => edge.roomIds.length === 2)!;
    const next = applyWallDragByOffset([livingRoom, bedroom], shared.id, 9.8, [1, 0], 0.6);
    const movedBedroom = next.find((room) => room.id === "bedroom")!;

    expect(Math.abs(movedBedroom.polygon[1][0] - movedBedroom.polygon[0][0])).toBeGreaterThanOrEqual(0.59);
  });

  it("hit tests the nearest wall edge", () => {
    const graph = deriveWallGraph([livingRoom, bedroom]);
    const hit = hitTestWalls([10, 4], graph);

    expect(hit?.roomIds.sort()).toEqual(["bedroom", "living"]);
  });
});
