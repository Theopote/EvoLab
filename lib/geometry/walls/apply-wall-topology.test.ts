import { describe, expect, it } from "vitest";
import { applyLevelWallMerge, applyLevelWallSplit } from "@/lib/geometry/walls/apply-wall-topology";
import { edgeKey } from "@/lib/wall-extractor";
import type { Level, Point, Room, Wall } from "@/lib/project-types";

const livingRoom: Room = {
  id: "living",
  name: "Living",
  type: "living_room",
  zone: "public",
  polygon: [
    [0, 0],
    [10, 0],
    [10, 4],
    [0, 4]
  ],
  areaSqm: 40,
  ceilingHeight: 3,
  doors: [],
  windows: []
};

const wallSouthA: Wall = {
  id: "cad-south-a",
  start: [0, 0],
  end: [5, 0],
  thickness: 0.18,
  height: 3,
  type: "external",
  roomIds: ["living"]
};

const wallSouthB: Wall = {
  id: "cad-south-b",
  start: [5, 0],
  end: [10, 0],
  thickness: 0.18,
  height: 3,
  type: "external",
  roomIds: ["living"]
};

function levelWithSplitWalls(): Level {
  return {
    id: "level-01",
    name: "Level 01",
    floorNumber: 1,
    elevation: 0,
    height: 3,
    rooms: [livingRoom],
    walls: [wallSouthA, wallSouthB],
    openings: []
  };
}

describe("apply-wall-topology", () => {
  it("merges collinear walls and removes the shared room vertex", () => {
    const level = levelWithSplitWalls();
    const next = applyLevelWallMerge(level, "cad-south-a", "cad-south-b");

    expect(next?.walls).toHaveLength(1);
    expect(next?.walls[0]?.id).toBe("cad-south-a");
    expect(next?.walls[0]?.end).toEqual([10, 0]);
    expect(next?.rooms[0]?.polygon).toEqual([
      [0, 0],
      [10, 0],
      [10, 4],
      [0, 4]
    ]);
  });

  it("splits a wall and inserts a vertex on the host room edge", () => {
    const mergedWall: Wall = {
      id: "cad-south",
      start: [0, 0],
      end: [10, 0],
      thickness: 0.18,
      height: 3,
      type: "external",
      roomIds: ["living"]
    };
    const level: Level = {
      ...levelWithSplitWalls(),
      walls: [mergedWall],
      openings: []
    };

    const next = applyLevelWallSplit(level, "cad-south", 0.5);

    expect(next?.walls).toHaveLength(2);
    expect(next?.walls[0]?.end).toEqual([5, 0]);
    expect(next?.walls[1]?.start).toEqual([5, 0]);
    expect(next?.rooms[0]?.polygon.some((point) => point[0] === 5 && point[1] === 0)).toBe(true);
    expect(edgeKey(next!.walls[0]!.start, next!.walls[0]!.end)).not.toBe(
      edgeKey(next!.walls[1]!.start, next!.walls[1]!.end)
    );
  });
});
