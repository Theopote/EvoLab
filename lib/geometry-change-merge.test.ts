import { describe, expect, it } from "vitest";
import {
  GEOMETRY_CHANGE_MERGE_MS,
  mergeGeometryChangeSet,
  shouldMergeGeometryChange,
  startGeometryChangeBurst
} from "@/lib/geometry-change-merge";
import type { PlanVersion } from "@/lib/project-types";

function versionWithArea(areaSqm: number): PlanVersion {
  return {
    id: "plan-a",
    label: "Plan A",
    createdAt: "2026-01-01T00:00:00.000Z",
    outline: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ],
    overallBounds: { width: 10, height: 10 },
    rooms: [
      {
        id: "room-a",
        name: "Room A",
        type: "office",
        zone: "private",
        polygon: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10]
        ],
        areaSqm,
        ceilingHeight: 3,
        doors: [],
        windows: []
      }
    ],
    levels: [],
    building: {
      id: "building-a",
      name: "Building A",
      boundary: {
        id: "boundary-a",
        polygon: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10]
        ],
        type: "site"
      },
      levels: [],
      floors: [],
      cores: [],
      grids: []
    },
    scores: {
      areaEfficiency: 0,
      circulationScore: 0,
      daylightScore: 0,
      mepAlignmentScore: 0,
      riskCount: 0
    }
  };
}

describe("geometry change merge", () => {
  it("starts a burst with a base snapshot", () => {
    const base = versionWithArea(80);
    const target = versionWithArea(90);
    const { changeSet, burst } = startGeometryChangeBurst(base, target, 1000);

    expect(changeSet.baseVersionId).toBe("plan-a");
    expect(burst.baseVersionSnapshot.rooms[0]?.areaSqm).toBe(80);
    expect(burst.changeSetId).toBe(changeSet.id);
  });

  it("merges repeated geometry edits within the window", () => {
    const base = versionWithArea(80);
    const first = versionWithArea(85);
    const second = versionWithArea(92);
    const started = startGeometryChangeBurst(base, first, 1000);

    expect(shouldMergeGeometryChange(started.burst, "plan-a", 1000 + GEOMETRY_CHANGE_MERGE_MS)).toBe(true);
    expect(shouldMergeGeometryChange(started.burst, "plan-a", 1000 + GEOMETRY_CHANGE_MERGE_MS + 1)).toBe(false);

    const merged = mergeGeometryChangeSet([started.changeSet], started.burst, second, 1500);

    expect(merged.changeSets[0]?.changes.some((change) => change.after === 92)).toBe(true);
    expect(merged.burst.lastCommittedAt).toBe(1500);
  });
});
