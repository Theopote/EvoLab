import { describe, expect, it } from "vitest";
import { normalizePlanVersion, type PlanVersionDraft } from "@/lib/architecture-model";
import { edgeKey } from "@/lib/wall-extractor";
import {
  openingsAlignWithWalls,
  resolveLevelWalls,
  shouldPreserveAuthoritativeWalls
} from "@/lib/geometry/walls/resolve-level-walls";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";

const outline: Point[] = [
  [0, 0],
  [12, 0],
  [12, 10],
  [0, 10]
];

const insetRoom: Room = {
  id: "room-a",
  name: "Office",
  type: "office",
  zone: "private",
  polygon: [
    [1, 1],
    [11, 1],
    [11, 9],
    [1, 9]
  ],
  areaSqm: 80,
  ceilingHeight: 3,
  doors: [],
  windows: []
};

const authoritativeWalls: Wall[] = [
  {
    id: "cad-wall-north",
    start: [0, 0],
    end: [12, 0],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a"]
  },
  {
    id: "cad-wall-east",
    start: [12, 0],
    end: [12, 10],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a"]
  },
  {
    id: "cad-wall-south",
    start: [12, 10],
    end: [0, 10],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a"]
  },
  {
    id: "cad-wall-west",
    start: [0, 10],
    end: [0, 0],
    thickness: 0.3,
    height: 3,
    type: "external",
    roomIds: ["room-a"]
  }
];

const southWall = authoritativeWalls[2]!;

const authoritativeOpening: OpeningElement = {
  id: "cad-door-1",
  wallId: southWall.id,
  wallEdgeId: edgeKey(southWall.start, southWall.end),
  positionOnEdge: 0.5,
  type: "door",
  center: [6, 10],
  width: 1,
  height: 2.1,
  roomIds: ["room-a"]
};

function wallFirstDraft(overrides?: Partial<Level>): PlanVersionDraft {
  return {
    id: "wall-first-scheme",
    label: "Wall-first scheme",
    createdAt: "2026-06-25T00:00:00.000Z",
    outline,
    overallBounds: { width: 12, height: 10 },
    rooms: [{ ...insetRoom, levelId: "level-01" }],
    levels: [
      {
        id: "level-01",
        name: "Level 01",
        floorNumber: 1,
        elevation: 0,
        height: 3,
        rooms: [{ ...insetRoom, levelId: "level-01" }],
        walls: authoritativeWalls,
        openings: [authoritativeOpening]
      }
    ]
  };
}

describe("resolve-level-walls", () => {
  it("preserves authoritative walls when openings align", () => {
    const level = wallFirstDraft().levels[0]!;

    expect(shouldPreserveAuthoritativeWalls(level)).toBe(true);
    expect(openingsAlignWithWalls(level.openings, level.walls)).toBe(true);

    const resolved = resolveLevelWalls(level, level.rooms, outline);

    expect(resolved.map((wall) => wall.id)).toEqual(authoritativeWalls.map((wall) => wall.id));
    expect(resolved[0]?.thickness).toBe(0.3);
  });

  it("falls back to room extraction when an opening does not resolve", () => {
    const level = wallFirstDraft().levels[0]!;
    const brokenOpening: OpeningElement = {
      ...authoritativeOpening,
      wallId: "missing-wall",
      wallEdgeId: "0,0|99,99"
    };

    expect(shouldPreserveAuthoritativeWalls({ walls: level.walls, openings: [brokenOpening] })).toBe(false);

    const resolved = resolveLevelWalls(
      { walls: level.walls, openings: [brokenOpening] },
      level.rooms,
      outline
    );

    expect(resolved.some((wall) => wall.id.startsWith("cad-wall-"))).toBe(false);
    expect(resolved.length).toBeGreaterThanOrEqual(4);
  });
});

describe("normalizePlanVersion wall preservation", () => {
  it("keeps authoritative wall ids and openings across normalize", () => {
    const normalized = normalizePlanVersion(wallFirstDraft());
    const level = normalized.levels[0]!;

    expect(level.walls.map((wall) => wall.id)).toEqual(authoritativeWalls.map((wall) => wall.id));
    expect(level.openings[0]?.id).toBe("cad-door-1");
    expect(level.openings[0]?.wallId).toBe("cad-wall-south");
  });

  it("survives a second normalize pass without reverting to room-derived walls", () => {
    const once = normalizePlanVersion(wallFirstDraft());
    const twice = normalizePlanVersion(once);

    expect(twice.levels[0]?.walls.map((wall) => wall.id)).toEqual(authoritativeWalls.map((wall) => wall.id));
  });

  it("still derives walls from rooms when no authoritative wall set exists", () => {
    const normalized = normalizePlanVersion({
      ...wallFirstDraft(),
      levels: [
        {
          ...wallFirstDraft().levels[0]!,
          walls: [],
          openings: []
        }
      ]
    });

    const level = normalized.levels[0]!;

    expect(level.walls.length).toBeGreaterThanOrEqual(4);
    expect(level.walls.every((wall) => wall.id.startsWith("wall-"))).toBe(true);
  });

  it("falls back to room-derived walls when openings no longer align", () => {
    const draft = wallFirstDraft();
    draft.levels[0]!.openings = [
      {
        ...authoritativeOpening,
        wallId: "missing-wall",
        wallEdgeId: "0,0|99,99"
      }
    ];

    const normalized = normalizePlanVersion(draft);
    const level = normalized.levels[0]!;

    expect(level.walls.some((wall) => wall.id.startsWith("cad-wall-"))).toBe(false);
    expect(level.walls.length).toBeGreaterThanOrEqual(4);
  });
});
