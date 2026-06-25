import { describe, expect, it } from "vitest";
import {
  normalizeOpeningElement,
  remapOpeningByWallEdge,
  resolveWallForOpening,
  wallEdgeIdFromWall
} from "@/lib/opening-edge-utils";
import type { OpeningElement, Wall } from "@/lib/project-types";

const wall: Wall = {
  id: "wall-0,0|10,0",
  start: [0, 0],
  end: [10, 0],
  thickness: 0.18,
  height: 3,
  type: "internal",
  roomIds: ["room-a", "room-b"]
};

describe("opening edge utils", () => {
  it("resolves openings by wallEdgeId", () => {
    const opening: OpeningElement = {
      id: "door-1",
      wallId: "stale-id",
      wallEdgeId: "0,0|10,0",
      positionOnEdge: 0.5,
      type: "door",
      center: [5, 0],
      width: 1,
      height: 2.1
    };

    expect(resolveWallForOpening(opening, [wall])?.id).toBe(wall.id);
  });

  it("normalizes legacy wallId openings onto wallEdgeId", () => {
    const opening: OpeningElement = {
      id: "door-1",
      wallId: wall.id,
      type: "door",
      center: [2, 0],
      width: 1,
      height: 2.1
    };

    const normalized = normalizeOpeningElement(opening, [wall]);

    expect(normalized.wallEdgeId).toBe(wallEdgeIdFromWall(wall));
    expect(normalized.positionOnEdge).toBeCloseTo(0.2, 2);
  });

  it("remaps openings after wall ids change but edge key stays stable", () => {
    const opening: OpeningElement = {
      id: "door-1",
      wallId: wall.id,
      wallEdgeId: wallEdgeIdFromWall(wall),
      positionOnEdge: 0.4,
      type: "door",
      center: [4, 0],
      width: 1,
      height: 2.1
    };
    const nextWall: Wall = { ...wall, id: "wall-regenerated" };

    const remapped = remapOpeningByWallEdge(opening, [wall], [nextWall]);

    expect(remapped?.wallId).toBe("wall-regenerated");
    expect(remapped?.positionOnEdge).toBeCloseTo(0.4, 2);
  });

  it("remaps openings by stable wall id when endpoints move", () => {
    const opening: OpeningElement = {
      id: "door-1",
      wallId: "cad-wall-1",
      wallEdgeId: wallEdgeIdFromWall(wall),
      positionOnEdge: 0.5,
      type: "door",
      center: [5, 0],
      width: 1,
      height: 2.1
    };
    const movedWall: Wall = {
      ...wall,
      id: "cad-wall-1",
      start: [1, 0],
      end: [11, 0]
    };

    const remapped = remapOpeningByWallEdge(opening, [{ ...wall, id: "cad-wall-1" }], [movedWall]);

    expect(remapped?.wallId).toBe("cad-wall-1");
    expect(remapped?.center[0]).toBeCloseTo(6, 2);
  });
});
