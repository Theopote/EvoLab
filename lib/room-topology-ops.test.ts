import { describe, expect, it } from "vitest";
import {
  findMergeableNeighborIds,
  mergeAdjacentRooms,
  roomsShareInteriorWall,
  splitRectRoom
} from "@/lib/room-topology-ops";
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

describe("room topology ops", () => {
  it("splits a rectangular room", () => {
    const split = splitRectRoom(livingRoom, "vertical", 0.5, { id: "living-b", name: "Living B" });

    expect(split?.first.polygon[1][0]).toBeCloseTo(5, 3);
    expect(split?.second.id).toBe("living-b");
  });

  it("detects mergeable neighbors across a shared wall", () => {
    expect(roomsShareInteriorWall(livingRoom, bedroom)).toBe(true);
    expect(findMergeableNeighborIds("living", [livingRoom, bedroom])).toEqual(["bedroom"]);
  });

  it("merges two adjacent rooms into one polygon", () => {
    const merged = mergeAdjacentRooms(livingRoom, bedroom, { id: "suite", name: "Suite" });

    expect(merged?.id).toBe("suite");
    expect(merged?.areaSqm).toBeCloseTo(160, 0);
    expect(merged?.polygon.length).toBeGreaterThanOrEqual(4);
  });
});
