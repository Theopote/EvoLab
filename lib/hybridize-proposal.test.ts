import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { buildHybridModifyPlanResponse } from "@/lib/hybridize-proposal";
import { applyPlanOperations } from "@/lib/plan-change-engine";

describe("hybridize-proposal", () => {
  it("wraps a merged layout as a replace_rooms proposal", () => {
    const baseVersion = initialProjectData.versions[0]!;
    const mergedVersion = {
      ...baseVersion,
      rooms: baseVersion.rooms.map((room, index) =>
        index === 0
          ? {
              ...room,
              polygon: room.polygon.map(([x, y]) => [x + 0.5, y] as const)
            }
          : room
      )
    };

    const response = buildHybridModifyPlanResponse({
      baseVersion,
      mergedVersion,
      intent: "Hybridize schemes",
      meta: {
        keptFromA: [baseVersion.rooms[1]?.id ?? "room-01"],
        keptFromB: [baseVersion.rooms[2]?.id ?? "room-02"],
        versionAId: baseVersion.id,
        versionBId: "version-b",
        priority: "A"
      }
    });

    expect(response.mode).toBe("proposal");
    expect(response.proposal.operations[0]?.type).toBe("replace_rooms");

    const replayed = applyPlanOperations(baseVersion, response.proposal.operations);
    expect(replayed.rooms[0]?.polygon).toEqual(mergedVersion.rooms[0]?.polygon);
  });
});
