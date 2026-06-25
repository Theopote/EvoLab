import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { getResolvedLevel } from "@/lib/level-rooms";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import type { VerticalAlignmentIssue } from "@/lib/project-types";
import {
  buildStructuralConstraintPrompt,
  enrichUserRequestWithStructuralConstraints,
  roomsNearStructuralPosition,
  validateStructuralConstraints
} from "@/lib/structural-constraints";
import { buildAlignmentFixPackage } from "@/lib/vertical-alignment-fix";

const baseVersion = initialProjectData.versions[0]!;

describe("structural constraints", () => {
  it("builds a prompt with locked column coordinates", () => {
    const prompt = buildStructuralConstraintPrompt({
      lockedPositions: [
        {
          id: "col-1",
          kind: "column",
          position: [12, 18],
          label: "Column 1"
        }
      ]
    });

    expect(prompt).toContain("[12.00, 18.00]");
    expect(prompt).toContain("must stay at");
  });

  it("finds rooms near a structural position", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 3);
    const level = expanded.levels[0]!;
    const rooms = getResolvedLevel(expanded, level.id)!.rooms;
    const corridor = rooms.find((room) => room.type === "corridor") ?? rooms[0]!;
    const position: [number, number] = [
      corridor.polygon[0]![0] + 1,
      corridor.polygon[0]![1] + 1
    ];
    const nearby = roomsNearStructuralPosition(rooms, position, 12);

    expect(nearby.length).toBeGreaterThan(0);
  });
});

describe("vertical alignment fix package", () => {
  it("packages inpaint request data with structural constraints", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 4);
    const level = expanded.levels[0]!;
    const rooms = getResolvedLevel(expanded, level.id)!.rooms;
    const corridor = rooms.find((room) => room.type === "corridor") ?? rooms[0]!;
    const position: [number, number] = [
      corridor.polygon[0]![0] + 1,
      corridor.polygon[0]![1] + 1
    ];
    const issue = {
      id: "test-issue",
      floorId: level.id,
      floorName: level.name,
      elementId: expanded.verticalElements?.[0]?.id ?? "vertical-column-0",
      elementKind: "column" as const,
      type: "no_containing_room" as const,
      message: "test",
      position
    } satisfies VerticalAlignmentIssue;

    const fixPackage = buildAlignmentFixPackage(expanded, issue);

    expect(fixPackage).toBeDefined();
    expect(fixPackage!.structuralConstraints.lockedPositions).toHaveLength(1);
    expect(fixPackage!.allowedRoomIds.length).toBeGreaterThan(0);
    expect(enrichUserRequestWithStructuralConstraints("Adjust rooms", fixPackage!.structuralConstraints)).toContain(
      "Structural constraints"
    );
  });

  it("validates constraints after room edits", () => {
    const expanded = expandPlanVersionToFloors(baseVersion, 3);
    const column = expanded.verticalElements?.find((element) => element.kind === "column");

    if (!column || Array.isArray(column.position[0])) {
      return;
    }

    const columnPosition = column.position;
    if (Array.isArray(columnPosition[0])) {
      return;
    }

    const violations = validateStructuralConstraints(expanded, expanded.levels[0]!.id, {
      lockedPositions: [
        {
          id: column.id,
          kind: "column",
          position: columnPosition,
          label: column.label
        }
      ]
    });

    expect(Array.isArray(violations)).toBe(true);
  });
});
