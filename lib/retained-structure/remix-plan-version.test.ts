import { describe, expect, it } from "vitest";
import { remixPlanWithRetainedStructure } from "@/lib/retained-structure/remix-plan-version";
import { isRetainedStructureRoom, summarizeRetainedStructure } from "@/lib/retained-structure/structure-rooms";
import { createDemoProjectData } from "@/lib/typologies";

describe("remixPlanWithRetainedStructure", () => {
  const source = createDemoProjectData("healthcare").versions[0]!;

  it("preserves core and shaft room geometry after relayout", () => {
    const summary = summarizeRetainedStructure(source);
    expect(summary.preservedRooms.length).toBeGreaterThan(0);

    const remixed = remixPlanWithRetainedStructure(source, {
      siteOutline: source.outline,
      layoutOutline: source.outline
    });

    for (const preserved of summary.preservedRooms) {
      const before = source.rooms.find((room) => room.id === preserved.id);
      const after = remixed.rooms.find((room) => room.id === preserved.id);

      expect(before).toBeDefined();
      expect(after).toBeDefined();
      expect(after?.polygon).toEqual(before?.polygon);
    }
  });

  it("does not duplicate auto-generated structure rooms from relayout", () => {
    const remixed = remixPlanWithRetainedStructure(source, {
      siteOutline: source.outline,
      layoutOutline: source.outline
    });

    const structureRooms = remixed.rooms.filter(isRetainedStructureRoom);
    const ids = structureRooms.map((room) => room.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("records remix metadata", () => {
    const remixed = remixPlanWithRetainedStructure(source, {
      siteOutline: source.outline,
      layoutOutline: source.outline
    });

    expect(remixed.metadata?.retainedStructureRemixAt).toBeTruthy();
    expect(remixed.metadata?.preservedStructureRoomIds?.length).toBeGreaterThan(0);
  });
});
