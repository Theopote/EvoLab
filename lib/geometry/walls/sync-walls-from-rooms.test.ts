import { describe, expect, it } from "vitest";
import { normalizePlanVersion } from "@/lib/architecture-model";
import { splitRectRoom } from "@/lib/room-topology-ops";
import { edgeKey } from "@/lib/wall-extractor";
import {
  reconcileAuthoritativeWalls,
  syncLevelGeometryFromRooms,
  wallsAlignWithRoomGraph
} from "@/lib/geometry/walls/sync-walls-from-rooms";
import { canMergeWalls, mergeWalls, splitWallAtParam } from "@/lib/geometry/walls/merge-split";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";

const outline: Point[] = [
  [0, 0],
  [20, 0],
  [20, 8],
  [0, 8]
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

function authoritativeLevel(): Level {
  const walls: Wall[] = [
    {
      id: "cad-west",
      start: [0, 8],
      end: [0, 0],
      thickness: 0.3,
      height: 3,
      type: "external",
      roomIds: ["living"]
    },
    {
      id: "cad-south-living",
      start: [0, 0],
      end: [10, 0],
      thickness: 0.3,
      height: 3,
      type: "external",
      roomIds: ["living"]
    },
    {
      id: "cad-shared",
      start: [10, 0],
      end: [10, 8],
      thickness: 0.18,
      height: 3,
      type: "internal",
      roomIds: ["living", "bedroom"]
    },
    {
      id: "cad-south-bedroom",
      start: [10, 0],
      end: [20, 0],
      thickness: 0.3,
      height: 3,
      type: "external",
      roomIds: ["bedroom"]
    },
    {
      id: "cad-east",
      start: [20, 0],
      end: [20, 8],
      thickness: 0.3,
      height: 3,
      type: "external",
      roomIds: ["bedroom"]
    },
    {
      id: "cad-north-living",
      start: [0, 8],
      end: [10, 8],
      thickness: 0.3,
      height: 3,
      type: "external",
      roomIds: ["living"]
    },
    {
      id: "cad-north-bedroom",
      start: [10, 8],
      end: [20, 8],
      thickness: 0.3,
      height: 3,
      type: "external",
      roomIds: ["bedroom"]
    }
  ];

  return {
    id: "level-01",
    name: "Level 01",
    floorNumber: 1,
    elevation: 0,
    height: 3,
    rooms: [livingRoom, bedroom],
    walls,
    openings: []
  };
}

describe("sync-walls-from-rooms", () => {
  it("preserves cad wall ids while reconciling room ids", () => {
    const level = authoritativeLevel();
    const nextRooms = level.rooms.map((room) =>
      room.id === "living"
        ? {
            ...room,
            polygon: [
              [0, 0],
              [11, 0],
              [11, 8],
              [0, 8]
            ] as Point[]
          }
        : {
            ...room,
            polygon: [
              [11, 0],
              [20, 0],
              [20, 8],
              [11, 8]
            ] as Point[]
          }
    );

    const reconciled = reconcileAuthoritativeWalls(level.walls, nextRooms, outline);

    expect(reconciled.some((wall) => wall.id === "cad-shared")).toBe(true);
    expect(reconciled.find((wall) => wall.id === "cad-shared")?.roomIds.sort()).toEqual(["bedroom", "living"]);
    expect(wallsAlignWithRoomGraph(reconciled, nextRooms, outline)).toBe(true);
  });

  it("adds a partition wall when a room is split", () => {
    const level = authoritativeLevel();
    const split = splitRectRoom(livingRoom, "vertical", 0.5, {
      id: "living-b",
      name: "Living B"
    });

    expect(split).toBeDefined();

    const nextRooms = [split!.first, split!.second, bedroom];
    const synced = syncLevelGeometryFromRooms(level, nextRooms, outline);

    expect(synced.walls.length).toBeGreaterThan(level.walls.length);
    expect(synced.walls.some((wall) => wall.id === "cad-west")).toBe(true);
    expect(wallsAlignWithRoomGraph(synced.walls, nextRooms, outline)).toBe(true);
  });

  it("removes the shared interior wall when rooms merge through normalize", () => {
    const level = authoritativeLevel();
    const mergedRoom: Room = {
      ...livingRoom,
      polygon: [
        [0, 0],
        [20, 0],
        [20, 8],
        [0, 8]
      ],
      areaSqm: 160
    };
    const draft = {
      id: "scheme",
      label: "Scheme",
      createdAt: "2026-06-25T00:00:00.000Z",
      outline,
      overallBounds: { width: 20, height: 8 },
      rooms: [mergedRoom],
      levels: [{ ...level, rooms: [mergedRoom] }]
    };

    const normalized = normalizePlanVersion(draft);

    expect(normalized.levels[0]?.walls.some((wall) => wall.id === "cad-shared")).toBe(false);
    expect(normalized.levels[0]?.walls.some((wall) => wall.id === "cad-west")).toBe(true);
    expect(
      wallsAlignWithRoomGraph(normalized.levels[0]!.walls, normalized.levels[0]!.rooms, outline)
    ).toBe(true);
  });
});

describe("merge-split", () => {
  it("merges collinear walls and remaps openings", () => {
    const wallA: Wall = {
      id: "cad-a",
      start: [0, 0],
      end: [5, 0],
      thickness: 0.18,
      height: 3,
      type: "internal",
      roomIds: ["living"]
    };
    const wallB: Wall = {
      id: "cad-b",
      start: [5, 0],
      end: [10, 0],
      thickness: 0.18,
      height: 3,
      type: "internal",
      roomIds: ["living"]
    };
    const opening: OpeningElement = {
      id: "door-1",
      wallId: "cad-b",
      wallEdgeId: edgeKey(wallB.start, wallB.end),
      positionOnEdge: 0.5,
      type: "door",
      center: [7.5, 0],
      width: 1,
      height: 2.1,
      roomIds: ["living"]
    };

    expect(canMergeWalls([wallA, wallB], "cad-a", "cad-b")).toBe(true);

    const merged = mergeWalls([wallA, wallB], "cad-a", "cad-b", [opening]);

    expect(merged?.walls).toHaveLength(1);
    expect(merged?.walls[0]?.end).toEqual([10, 0]);
    expect(merged?.openings[0]?.wallId).toBe("cad-a");
    expect(merged?.openings[0]?.center[0]).toBeCloseTo(7.5, 2);
  });

  it("splits a wall and distributes openings by edge parameter", () => {
    const wall: Wall = {
      id: "cad-wall",
      start: [0, 0],
      end: [10, 0],
      thickness: 0.18,
      height: 3,
      type: "internal",
      roomIds: ["living"]
    };
    const openings: OpeningElement[] = [
      {
        id: "door-left",
        wallId: "cad-wall",
        wallEdgeId: edgeKey(wall.start, wall.end),
        positionOnEdge: 0.2,
        type: "door",
        center: [2, 0],
        width: 1,
        height: 2.1,
        roomIds: ["living"]
      },
      {
        id: "door-right",
        wallId: "cad-wall",
        wallEdgeId: edgeKey(wall.start, wall.end),
        positionOnEdge: 0.8,
        type: "door",
        center: [8, 0],
        width: 1,
        height: 2.1,
        roomIds: ["living"]
      }
    ];

    const split = splitWallAtParam([wall], "cad-wall", 0.5, "cad-wall-b", openings);

    expect(split?.walls).toHaveLength(2);
    expect(split?.openings.find((opening) => opening.id === "door-left")?.wallId).toBe("cad-wall");
    expect(split?.openings.find((opening) => opening.id === "door-right")?.wallId).toBe("cad-wall-b");
  });
});
