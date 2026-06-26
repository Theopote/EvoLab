import { describe, expect, it } from "vitest";
import { adaptTopologyForRemix } from "@/lib/retained-structure/adapt-topology-for-remix";
import { defaultRemixParameters } from "@/lib/retained-structure/remix-parameters";
import { remixPlanWithRetainedStructure } from "@/lib/retained-structure/remix-plan-version";
import { isRetainedStructureRoom, summarizeRetainedStructure } from "@/lib/retained-structure/structure-rooms";
import { extractTopologyFromVersion } from "@/lib/relayout-version";
import { createDemoProjectData } from "@/lib/typologies";

describe("adaptTopologyForRemix", () => {
  const source = createDemoProjectData("healthcare").versions[0]!;
  const sourceTopology = extractTopologyFromVersion(source)!;

  it("rebuilds program rooms for a different functional type", () => {
    const adapted = adaptTopologyForRemix(sourceTopology, source, {
      ...defaultRemixParameters({ relayoutableRoomCount: 5 }),
      targetFunctionalType: "office",
      targetRoomCount: 4,
      publicAreaRatio: 0.2
    });

    expect(adapted.rooms.some((room) => room.type === "office")).toBe(true);
    expect(adapted.rooms.filter((room) => room.type === "consultation")).toHaveLength(0);
  });

  it("respects target room count when splitting is allowed", () => {
    const adapted = adaptTopologyForRemix(sourceTopology, source, {
      ...defaultRemixParameters({ relayoutableRoomCount: 3 }),
      targetFunctionalType: "office",
      targetRoomCount: 6,
      allowSplitLargeRooms: true
    });

    const programRooms = adapted.rooms.filter(
      (room) => !["corridor", "lobby", "stair", "elevator", "shaft", "equipment_room"].includes(room.type)
    );

    expect(programRooms.length).toBeGreaterThanOrEqual(5);
  });

  it("removes corridor rooms for open strategy", () => {
    const adapted = adaptTopologyForRemix(sourceTopology, source, {
      ...defaultRemixParameters({ relayoutableRoomCount: 4 }),
      corridorStrategy: "open"
    });

    expect(adapted.rooms.some((room) => room.type === "corridor")).toBe(false);
  });
});

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

  it("records remix metadata and parameters", () => {
    const remixed = remixPlanWithRetainedStructure(source, {
      siteOutline: source.outline,
      layoutOutline: source.outline,
      targetFunctionalType: "residential",
      corridorStrategy: "side",
      layoutPriority: "circulation",
      targetRoomCount: 5,
      publicAreaRatio: 0.22
    });

    expect(remixed.metadata?.retainedStructureRemixAt).toBeTruthy();
    expect(remixed.metadata?.preservedStructureRoomIds?.length).toBeGreaterThan(0);
    expect(remixed.metadata?.remixParameters).toMatchObject({
      targetFunctionalType: "residential",
      corridorStrategy: "side",
      layoutPriority: "circulation",
      targetRoomCount: 5
    });
  });

  it("locks exterior windows when requested", () => {
    const sourceWithWindows = {
      ...source,
      rooms: source.rooms.map((room, index) =>
        index === 0
          ? {
              ...room,
              windows: [{ wall: "south" as const, position: 0.4, width: 2.4 }]
            }
          : room
      )
    };
    const lockedRoomId = sourceWithWindows.rooms[0]!.id;
    const lockedWindows = sourceWithWindows.rooms[0]!.windows;

    const remixed = remixPlanWithRetainedStructure(sourceWithWindows, {
      siteOutline: source.outline,
      layoutOutline: source.outline,
      lockExteriorWindows: true
    });

    const remixedRoom = remixed.rooms.find((room) => room.id === lockedRoomId);
    expect(remixedRoom?.windows).toEqual(lockedWindows);
  });
});
