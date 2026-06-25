import { describe, expect, it } from "vitest";
import { applyLevelWallDrag } from "@/lib/geometry/walls/apply-wall-drag";
import { applyWallGeometryPatch } from "@/lib/geometry/walls/apply-wall-geometry";
import { findWallEdgeForWall, updateWallEndpoints } from "@/lib/geometry/walls/sync-rooms-from-walls";
import { edgeKey } from "@/lib/wall-extractor";
import {
  applyWallDragByOffset,
  deriveWallGraph,
  edgeKeyToWallIdFromKey
} from "@/lib/wall-graph";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";

const outline: Point[] = [
  [0, 0],
  [12, 0],
  [12, 10],
  [0, 10]
];

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

function sharedWallFromRooms(rooms: Room[]): Wall {
  const graph = deriveWallGraph(rooms);
  const shared = graph.edges.find((edge) => edge.roomIds.length === 2)!;

  return {
    id: "cad-shared-wall",
    start: [...shared.nodeA] as Point,
    end: [...shared.nodeB] as Point,
    thickness: 0.18,
    height: 3,
    type: "internal",
    roomIds: shared.roomIds
  };
}

function levelWithAuthoritativeSharedWall(): Level {
  const rooms = [livingRoom, bedroom];
  const sharedWall = sharedWallFromRooms(rooms);

  return {
    id: "level-01",
    name: "Level 01",
    floorNumber: 1,
    elevation: 0,
    height: 3,
    rooms,
    walls: [sharedWall],
    openings: []
  };
}

describe("sync-rooms-from-walls", () => {
  it("finds wall edges for cad wall ids by geometry", () => {
    const level = levelWithAuthoritativeSharedWall();
    const wall = level.walls[0]!;
    const edge = findWallEdgeForWall(wall, level.rooms);

    expect(edge?.id).toBe("cad-shared-wall");
    expect(edge?.roomIds.sort()).toEqual(["bedroom", "living"]);
  });

  it("updates shared endpoints across connected walls", () => {
    const wallA: Wall = {
      id: "wall-a",
      start: [0, 0],
      end: [10, 0],
      thickness: 0.18,
      height: 3,
      type: "external",
      roomIds: ["living"]
    };
    const wallB: Wall = {
      id: "wall-b",
      start: [10, 0],
      end: [10, 8],
      thickness: 0.18,
      height: 3,
      type: "external",
      roomIds: ["living"]
    };

    const next = updateWallEndpoints([wallA, wallB], "wall-a", [0, 0], [11, 0]);

    expect(next.find((wall) => wall.id === "wall-a")?.end).toEqual([11, 0]);
    expect(next.find((wall) => wall.id === "wall-b")?.start).toEqual([11, 0]);
  });
});

describe("applyLevelWallDrag", () => {
  it("writes authoritative walls first and reverse-syncs rooms", () => {
    const level = levelWithAuthoritativeSharedWall();
    const wall = level.walls[0]!;
    const next = applyLevelWallDrag(level, wall.id, 1, [1, 0], outline);
    const movedLiving = next.rooms.find((room) => room.id === "living")!;
    const movedBedroom = next.rooms.find((room) => room.id === "bedroom")!;
    const movedWall = next.walls.find((candidate) => candidate.id === wall.id)!;

    expect(movedWall.start[0]).toBeCloseTo(11, 3);
    expect(movedWall.end[0]).toBeCloseTo(11, 3);
    expect(movedLiving.polygon[1][0]).toBeCloseTo(11, 3);
    expect(movedBedroom.polygon[0][0]).toBeCloseTo(11, 3);
  });

  it("keeps the authoritative wall id on the dragged level", () => {
    const level = levelWithAuthoritativeSharedWall();
    const wall = level.walls[0]!;
    const dragged = applyLevelWallDrag(level, wall.id, 1, [1, 0], outline);

    expect(dragged.walls.some((candidate) => candidate.id === wall.id)).toBe(true);
  });

  it("falls back to room-first drag when wall is missing from level.walls", () => {
    const rooms = [livingRoom, bedroom];
    const graph = deriveWallGraph(rooms);
    const shared = graph.edges.find((edge) => edge.roomIds.length === 2)!;
    const level: Level = {
      id: "level-01",
      name: "Level 01",
      floorNumber: 1,
      elevation: 0,
      height: 3,
      rooms,
      walls: [],
      openings: []
    };

    const next = applyLevelWallDrag(level, shared.id, 1, [1, 0], outline);
    const roomFirst = applyWallDragByOffset(rooms, shared.id, 1, [1, 0]);

    expect(next.rooms).toEqual(roomFirst);
    expect(next.walls.length).toBeGreaterThan(0);
  });
});

describe("applyWallGeometryPatch", () => {
  it("syncs rooms when wall endpoints change", () => {
    const level = levelWithAuthoritativeSharedWall();
    const wall = level.walls[0]!;
    const next = applyWallGeometryPatch(level, wall.id, {
      start: [wall.start[0] + 1, wall.start[1]],
      end: [wall.end[0] + 1, wall.end[1]]
    });

    expect(next.walls.find((candidate) => candidate.id === wall.id)?.start[0]).toBeCloseTo(11, 3);
    expect(next.rooms.find((room) => room.id === "living")?.polygon[1][0]).toBeCloseTo(11, 3);
  });

  it("keeps opening alignment when wall endpoints move", () => {
    const rooms = [livingRoom, bedroom];
    const shared = sharedWallFromRooms(rooms);
    const opening: OpeningElement = {
      id: "door-1",
      wallId: shared.id,
      wallEdgeId: edgeKey(shared.start, shared.end),
      positionOnEdge: 0.5,
      type: "door",
      center: [10, 4],
      width: 1,
      height: 2.1,
      roomIds: ["living", "bedroom"]
    };
    const level: Level = {
      id: "level-01",
      name: "Level 01",
      floorNumber: 1,
      elevation: 0,
      height: 3,
      rooms,
      walls: [shared],
      openings: [opening]
    };

    const next = applyWallGeometryPatch(level, shared.id, {
      start: [shared.start[0] + 1, shared.start[1]],
      end: [shared.end[0] + 1, shared.end[1]]
    });

    expect(next.openings[0]?.wallId).toBe(shared.id);
    expect(next.openings[0]?.center[0]).toBeCloseTo(11, 3);
  });
});

describe("findWallEdgeForWall derived ids", () => {
  it("still resolves graph wall ids", () => {
    const rooms = [livingRoom, bedroom];
    const graph = deriveWallGraph(rooms);
    const shared = graph.edges.find((edge) => edge.roomIds.length === 2)!;
    const wall: Wall = {
      id: shared.id,
      start: shared.nodeA,
      end: shared.nodeB,
      thickness: 0.18,
      height: 3,
      type: "internal",
      roomIds: shared.roomIds
    };

    expect(findWallEdgeForWall(wall, rooms)?.id).toBe(shared.id);
    expect(shared.id).toBe(edgeKeyToWallIdFromKey(shared.key));
  });
});
