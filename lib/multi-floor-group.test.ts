import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import {
  applyLevelRoomsToVersion,
  getResolvedLevel,
  resolveLevelRooms
} from "@/lib/level-rooms";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";

const baseVersion = initialProjectData.versions[0]!;

describe("standard floor groups", () => {
  it("expands typical floors into one shared group", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);

    expect(expanded.standardFloorGroups).toHaveLength(1);
    expect(expanded.standardFloorGroups?.[0]?.memberFloorIds).toEqual(["level-02", "level-03"]);
    expect(expanded.levels.find((level) => level.id === "level-02")?.standardFloorGroupId).toBe(
      expanded.standardFloorGroups?.[0]?.id
    );
    expect(expanded.levels.find((level) => level.id === "level-01")?.standardFloorGroupId).toBeUndefined();
  });

  it("resolves the same rooms for every member floor", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 5);
    const group = expanded.standardFloorGroups?.[0];
    const level2 = expanded.levels.find((item) => item.id === "level-02");
    const level3 = expanded.levels.find((item) => item.id === "level-03");

    expect(group?.rooms.length).toBeGreaterThan(0);
    expect(resolveLevelRooms(level2!, expanded.standardFloorGroups).map((room) => room.id)).toEqual(
      resolveLevelRooms(level3!, expanded.standardFloorGroups).map((room) => room.id)
    );
  });

  it("syncs edits on one member floor to all group members", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const level2 = getResolvedLevel(expanded, "level-02");
    const renamed = level2!.rooms.map((room) =>
      room.id === "lobby-01" ? { ...room, name: "Synced Typical Lobby" } : room
    );

    const next = applyLevelRoomsToVersion(expanded, "level-02", renamed)!;
    const level3 = getResolvedLevel(next, "level-03");

    expect(level3?.rooms.find((room) => room.id === "lobby-01")?.name).toBe("Synced Typical Lobby");
    expect(next.standardFloorGroups?.[0]?.rooms.find((room) => room.id === "lobby-01")?.name).toBe(
      "Synced Typical Lobby"
    );
  });
});
