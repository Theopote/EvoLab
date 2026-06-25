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

  it("detects renamed rooms as modified at level scope", () => {
    const project = createDemoProjectData("office");
    const base = project.versions[0]!;
    const levelId = base.levels[0]?.id;
    const preview = {
      ...base,
      rooms: base.rooms.map((room, index) => (index === 0 ? { ...room, name: "Renamed room" } : room))
    };

    const summary = summarizeRoomChangesAtLevel(base, preview, levelId);

    expect(summary.modified.length).toBeGreaterThan(0);
    expect(countGeometryDiffChanges(summary)).toBeGreaterThan(0);
  });
});
