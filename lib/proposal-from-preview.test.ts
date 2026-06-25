import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { applyPlanOperations } from "@/lib/plan-change-engine";
import {
  buildProposalFromVersionPreview,
  defaultAcceptedOperationIdsForSketch
} from "@/lib/proposal-from-preview";

const baseVersion = initialProjectData.versions[0]!;

describe("proposal-from-preview", () => {
  it("builds polygon update operations for reshaped rooms", () => {
    const office = baseVersion.rooms.find((room) => room.type === "office");

    if (!office) {
      return;
    }

    const previewVersion = {
      ...baseVersion,
      rooms: baseVersion.rooms.map((room) =>
        room.id === office.id
          ? {
              ...room,
              polygon: room.polygon.map(([x, y]) => [x + 0.5, y] as [number, number]),
              areaSqm: room.areaSqm + 1
            }
          : room
      )
    };

    const proposal = buildProposalFromVersionPreview(baseVersion, previewVersion, "Reshape office boundary");

    expect(proposal?.operations.some((operation) => operation.type === "update_room_polygon")).toBe(true);

    const applied = applyPlanOperations(baseVersion, proposal!.operations, { skipPostProcess: true });
    const updated = applied.rooms.find((room) => room.id === office.id);

    expect(updated?.polygon[0][0]).toBeGreaterThan(office.polygon[0][0]);
  });

  it("defaults sketch acceptance to high-confidence rooms only", () => {
    const proposal = buildProposalFromVersionPreview(
      baseVersion,
      {
        ...baseVersion,
        rooms: [
          ...baseVersion.rooms,
          {
            id: "sketch-room-a",
            name: "Sketch A",
            type: "office",
            zone: "private",
            polygon: [
              [40, 40],
              [46, 40],
              [46, 46],
              [40, 46]
            ],
            areaSqm: 36,
            doors: [],
            windows: []
          },
          {
            id: "sketch-room-b",
            name: "Sketch B",
            type: "office",
            zone: "private",
            polygon: [
              [48, 40],
              [54, 40],
              [54, 46],
              [48, 46]
            ],
            areaSqm: 36,
            doors: [],
            windows: []
          }
        ]
      },
      "Sketch input",
      { focusRoomIds: ["sketch-room-a", "sketch-room-b"] }
    );

    expect(proposal).toBeDefined();

    const accepted = defaultAcceptedOperationIdsForSketch(proposal!, ["sketch-room-b"]);

    expect(accepted.some((id) => id.includes("sketch-room-a"))).toBe(true);
    expect(accepted.some((id) => id.includes("sketch-room-b"))).toBe(false);
  });
});
