import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import {
  clampLegacyOpeningParams,
  enforceOpeningConstraintsOnVersion,
  sanitizeAddOpeningOperation,
  sanitizeRoomLegacyOpenings
} from "@/lib/opening-constraints";
import type { Room, Wall } from "@/lib/project-types";

const wall: Wall = {
  id: "wall-test",
  start: [0, 0],
  end: [8, 0],
  thickness: 0.2,
  height: 3,
  type: "internal",
  roomIds: ["room-a"]
};

const room: Room = {
  id: "room-a",
  name: "Office",
  type: "office",
  zone: "private",
  polygon: [
    [0, 0],
    [8, 0],
    [8, 6],
    [0, 6]
  ],
  areaSqm: 48,
  ceilingHeight: 3,
  doors: [{ wall: "south", position: 0.5, width: 1.2 }],
  windows: [{ wall: "north", position: 0.95, width: 2.5 }]
};

describe("opening constraints", () => {
  it("clamps oversized openings onto a wall", () => {
    const clamped = clampLegacyOpeningParams(wall, 7.5, 0.95);

    expect(clamped).not.toBeNull();
    expect(clamped!.width).toBeLessThan(7.5);
    expect(clamped!.position).toBeLessThan(0.95);
  });

  it("removes invalid legacy openings during room sanitization", () => {
    const result = sanitizeRoomLegacyOpenings(room, [wall]);

    expect(result.room.doors).toHaveLength(1);
    expect(result.room.windows).toHaveLength(0);
    expect(result.repairs.some((item) => item.includes("window"))).toBe(true);
  });

  it("sanitizes add_opening operations before execution", () => {
    const version = initialProjectData.versions[0]!;
    const sanitized = sanitizeAddOpeningOperation(version, {
      id: "op-door",
      type: "add_opening",
      label: "Add door",
      targetRoomIds: ["office-01"],
      roomId: "office-01",
      openingKind: "door",
      wall: "east",
      position: 0.99,
      width: 12
    });

    expect(sanitized).not.toBeNull();
    expect(sanitized!.width).toBeLessThan(12);
    expect(sanitized!.position).toBeLessThan(0.99);
  });

  it("enforces opening constraints on a full version", () => {
    const version = initialProjectData.versions[0]!;
    const withBadOpening: typeof version = {
      ...version,
      rooms: version.rooms.map((entry) =>
        entry.id === "office-01"
          ? {
              ...entry,
              windows: [{ wall: "north", position: 0.99, width: 6 }]
            }
          : entry
      )
    };

    const result = enforceOpeningConstraintsOnVersion(withBadOpening);

    const office = result.version.rooms.find((entry) => entry.id === "office-01");
    expect(office?.windows.every((opening) => opening.width <= 6)).toBe(true);
    expect(result.repairs.length).toBeGreaterThan(0);
  });
});
