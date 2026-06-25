import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import {
  applyImportReviewRooms,
  createTracedImportRoom,
  removeImportReviewRoom,
  resolveImportReviewRooms
} from "@/lib/import-review-utils";

const baseVersion = initialProjectData.versions[0];

describe("import review utils", () => {
  it("creates traced rooms with semantic defaults", () => {
    const room = createTracedImportRoom(
      [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3]
      ],
      "level-01",
      1
    );

    expect(room.name).toBe("Traced 1");
    expect(room.areaSqm).toBe(12);
    expect(room.ceilingHeight).toBe(3);
  });

  it("applies room geometry edits back into the version shell", () => {
    const rooms = resolveImportReviewRooms(baseVersion);
    const nextRooms = rooms.map((room, index) =>
      index === 0
        ? {
            ...room,
            polygon: room.polygon.map(([x, y]) => [x + 1, y + 1] as const)
          }
        : room
    );

    const nextVersion = applyImportReviewRooms(baseVersion, nextRooms as typeof rooms);

    expect(resolveImportReviewRooms(nextVersion)[0]?.polygon[0]?.[0]).toBe(rooms[0]?.polygon[0]?.[0]! + 1);
  });

  it("removes a room from the draft version", () => {
    const rooms = resolveImportReviewRooms(baseVersion);
    const targetId = rooms[0]?.id;

    expect(targetId).toBeTruthy();

    const nextVersion = removeImportReviewRoom(baseVersion, targetId!);

    expect(resolveImportReviewRooms(nextVersion).some((room) => room.id === targetId)).toBe(false);
  });
});
