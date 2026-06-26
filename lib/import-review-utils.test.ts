import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import {
  applyImportReviewRooms,
  createTracedImportRoom,
  recalculateImportReviewAreas,
  removeImportReviewRoom,
  resolveImportReviewRooms,
  updateImportReviewRoom,
  validateImportReviewDraft
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

  it("updates room metadata and recalculates areas", () => {
    const rooms = resolveImportReviewRooms(baseVersion);
    const targetId = rooms[0]!.id;

    const renamed = updateImportReviewRoom(baseVersion, targetId, { name: "Lobby", zone: "public" });
    expect(resolveImportReviewRooms(renamed)[0]?.name).toBe("Lobby");

    const recalculated = recalculateImportReviewAreas(renamed);
    expect(resolveImportReviewRooms(recalculated)[0]?.areaSqm).toBeGreaterThan(0);
  });

  it("flags overlapping rooms in import review validation", () => {
    const roomA = createTracedImportRoom(
      [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4]
      ],
      "level-01",
      1
    );
    const roomB = createTracedImportRoom(
      [
        [2, 2],
        [6, 2],
        [6, 6],
        [2, 6]
      ],
      "level-01",
      2
    );
    const version = applyImportReviewRooms(baseVersion, [roomA, roomB]);
    const issues = validateImportReviewDraft(version);

    expect(issues.some((issue) => issue.id === "room-overlap")).toBe(true);
  });
});
