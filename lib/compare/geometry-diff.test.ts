import { describe, expect, it } from "vitest";
import { createDemoProjectData } from "@/lib/typologies";
import { countGeometryDiffChanges, summarizeRoomChangesAtLevel } from "@/lib/compare/geometry-diff";

describe("compare geometry diff", () => {
  it("reports no changes for identical versions", () => {
    const project = createDemoProjectData("office");
    const version = project.versions[0]!;

    const summary = summarizeRoomChangesAtLevel(version, version, version.levels[0]?.id);

    expect(countGeometryDiffChanges(summary)).toBe(0);
  });

  it("detects geometry changes between versions", () => {
    const project = createDemoProjectData("office");
    const base = project.versions[0]!;
    const targetRoom = base.rooms[0]!;

    const preview = {
      ...base,
      rooms: base.rooms.map((room) =>
        room.id === targetRoom.id
          ? {
              ...room,
              polygon: room.polygon.map(([x, y]) => [x + 0.5, y] as [number, number])
            }
          : room
      )
    };

    const summary = summarizeRoomChangesAtLevel(base, preview);

    expect(summary.modified).toContain(targetRoom.id);
    expect(countGeometryDiffChanges(summary)).toBeGreaterThan(0);
  });
});
