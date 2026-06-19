import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { mergeHybridRooms } from "@/lib/hybridize-merge";

describe("hybridize-merge", () => {
  const versionA = initialProjectData.versions[0]!;
  const versionB = {
    ...versionA,
    id: "version-b",
    label: "Scheme B",
    rooms: versionA.rooms.map((room) =>
      room.id === versionA.rooms[0]?.id
        ? {
            ...room,
            polygon: room.polygon.map(([x, y]) => [x + 1, y + 1] as [number, number])
          }
        : room
    ),
    levels: versionA.levels.map((level) => ({
      ...level,
      rooms: level.rooms.map((room) =>
        room.id === versionA.rooms[0]?.id
          ? {
              ...room,
              polygon: room.polygon.map(([x, y]) => [x + 1, y + 1] as [number, number])
            }
          : room
      )
    }))
  };

  it("keeps polygons from each source for locked rooms", () => {
    const firstId = versionA.rooms[0]!.id;
    const secondId = versionA.rooms[1]!.id;
    const aiVersion = {
      ...versionA,
      rooms: versionA.rooms.map((room) => ({
        ...room,
        polygon: room.polygon.map(([x, y]) => [x + 5, y + 5] as [number, number])
      }))
    };

    const merged = mergeHybridRooms(versionA, versionB, aiVersion, [firstId], [secondId], "A");
    const lockedFromA = merged.find((room) => room.id === firstId);
    const lockedFromB = merged.find((room) => room.id === secondId);
    const filled = merged.find((room) => room.id === versionA.rooms[2]?.id);

    expect(lockedFromA?.polygon).toEqual(versionA.rooms[0]?.polygon);
    expect(lockedFromB?.polygon).toEqual(versionB.rooms[1]?.polygon);
    expect(filled?.polygon).toEqual(aiVersion.rooms[2]?.polygon);
  });

  it("uses priority when the same room id is locked on both sides", () => {
    const roomId = versionA.rooms[0]!.id;
    const aiVersion = versionA;

    const preferA = mergeHybridRooms(versionA, versionB, aiVersion, [roomId], [roomId], "A");
    const preferB = mergeHybridRooms(versionA, versionB, aiVersion, [roomId], [roomId], "B");

    expect(preferA.find((room) => room.id === roomId)?.polygon).toEqual(versionA.rooms[0]?.polygon);
    expect(preferB.find((room) => room.id === roomId)?.polygon).toEqual(versionB.rooms[0]?.polygon);
  });
});
