import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { buildRecognizedRoomsFromLoops, mergeSketchRoomsIntoVersion } from "@/lib/sketch-to-version";

describe("sketch-to-version", () => {
  it("builds fallback recognized rooms from closed loops", () => {
    const recognized = buildRecognizedRoomsFromLoops([
      {
        index: 0,
        polygon: [
          [1, 1],
          [5, 1],
          [5, 4],
          [1, 4]
        ]
      }
    ]);

    expect(recognized).toHaveLength(1);
    expect(recognized[0]?.room.name).toBe("Room 1");
    expect(recognized[0]?.confidence).toBe("high");
  });

  it("merges recognized sketch rooms into the active plan version", () => {
    const baseVersion = initialProjectData.versions[0];
    const recognized = buildRecognizedRoomsFromLoops([
      {
        index: 0,
        polygon: [
          [50, 30],
          [58, 30],
          [58, 38],
          [50, 38]
        ]
      }
    ]);
    const merged = mergeSketchRoomsIntoVersion(baseVersion, recognized, { append: true });

    expect(merged.label).toContain("Sketch");
    expect(merged.parentVersionId).toBe(baseVersion.id);
    expect(merged.rooms.length).toBeGreaterThanOrEqual(baseVersion.rooms.length);
    expect(merged.levels.length).toBeGreaterThan(0);
  });
});
