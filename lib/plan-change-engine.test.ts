import { describe, expect, it } from "vitest";
import { initialProjectData } from "@/lib/evolab-data";
import { summarizeRoomChanges } from "@/lib/plan-change-diff";
import {
  applyPlanOperations,
  applyPlanOperationsWithReport,
  isOperationBlockedByLocks
} from "@/lib/plan-change-engine";
import type { PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";

const baseVersion = initialProjectData.versions[0]!;

describe("plan-change-engine", () => {
  it("moves core rooms north without changing room ids", () => {
    const operation: PlanOperation = {
      id: "op-move-core",
      type: "move_core",
      label: "Move core north",
      targetRoomIds: ["core-01"],
      direction: "north",
      distanceMeters: 2
    };

    const next = applyPlanOperations(baseVersion, [operation], { skipPostProcess: true });
    const core = next.rooms.find((room) => room.id === "core-01");
    const previous = baseVersion.rooms.find((room) => room.id === "core-01");

    expect(core).toBeDefined();
    expect(previous).toBeDefined();
    expect(core!.polygon[0][1]).toBeLessThan(previous!.polygon[0][1]);
  });

  it("splits a room into two rooms", () => {
    const operation: PlanOperation = {
      id: "op-split-office",
      type: "split_room",
      label: "Split office",
      targetRoomIds: ["office-01"],
      roomId: "office-01",
      splitAxis: "vertical",
      splitRatio: 0.5,
      secondRoomName: "Office B"
    };

    const next = applyPlanOperations(baseVersion, [operation], { skipPostProcess: true });
    const changes = summarizeRoomChanges(baseVersion, next);

    expect(next.rooms.some((room) => room.id === "office-01")).toBe(true);
    expect(next.rooms.some((room) => room.name === "Office B")).toBe(true);
    expect(changes.added.length).toBe(1);
    expect(changes.modified).toContain("office-01");
  });

  it("merges adjacent rooms", () => {
    const left = baseVersion.rooms.find((room) => room.id === "office-01");
    const right = baseVersion.rooms.find((room) => room.id === "meeting-01");

    if (!left || !right) {
      return;
    }

    const operation: PlanOperation = {
      id: "op-merge-office",
      type: "merge_room",
      label: "Merge office and meeting",
      targetRoomIds: ["office-01", "meeting-01"],
      primaryRoomId: "office-01",
      secondaryRoomId: "meeting-01",
      mergedRoomName: "Office suite"
    };

    const next = applyPlanOperations(baseVersion, [operation], { skipPostProcess: true });
    const changes = summarizeRoomChanges(baseVersion, next);

    expect(next.rooms.some((room) => room.name === "Office suite")).toBe(true);
    expect(changes.removed.length).toBeGreaterThan(0);
  });

  it("skips operations outside the allowed inpaint region", () => {
    const corridor = baseVersion.rooms.find((room) => room.type === "corridor");
    const office = baseVersion.rooms.find((room) => room.type === "office");

    if (!corridor || !office) {
      return;
    }

    const operations: PlanOperation[] = [
      {
        id: "op-shift-office",
        type: "shift_rooms",
        label: "Shift office",
        targetRoomIds: [office.id],
        roomIds: [office.id],
        dx: 1,
        dy: 0
      },
      {
        id: "op-widen-corridor",
        type: "widen_corridor",
        label: "Widen corridor",
        targetRoomIds: [corridor.id],
        corridorIds: [corridor.id],
        extraWidthMeters: 0.4,
        side: "both"
      }
    ];

    const report = applyPlanOperationsWithReport(baseVersion, operations, {
      allowedRoomIds: [corridor.id],
      skipPostProcess: true
    });

    expect(report.appliedOperationIds).toEqual(["op-widen-corridor"]);
    expect(report.skippedOperations.some((item) => item.operationId === "op-shift-office")).toBe(true);
  });

  it("updates a room polygon in place", () => {
    const room = baseVersion.rooms.find((item) => item.type === "office");

    if (!room) {
      return;
    }

    const bounds = room.polygon.reduce(
      (acc, [x, y]) => ({
        minX: Math.min(acc.minX, x),
        minY: Math.min(acc.minY, y),
        maxX: Math.max(acc.maxX, x),
        maxY: Math.max(acc.maxY, y)
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );
    const polygon: [number, number][] = [
      [bounds.minX, bounds.minY],
      [bounds.maxX + 1, bounds.minY],
      [bounds.maxX + 1, bounds.maxY],
      [bounds.minX, bounds.maxY]
    ];

    const operation = {
      id: "op-update-polygon",
      type: "update_room_polygon" as const,
      label: "Reshape office",
      targetRoomIds: [room.id],
      roomId: room.id,
      polygon
    };

    const next = applyPlanOperations(baseVersion, [operation], { skipPostProcess: true });
    const updated = next.rooms.find((item) => item.id === room.id);

    expect(updated?.polygon[1][0]).toBeGreaterThan(room.polygon[1][0]);
  });

  it("adds a door opening to a room", () => {
    const operation: PlanOperation = {
      id: "op-add-door",
      type: "add_opening",
      label: "Add door",
      targetRoomIds: ["office-01"],
      roomId: "office-01",
      openingKind: "door",
      wall: "east",
      position: 0.4,
      width: 1.1
    };

    const next = applyPlanOperations(baseVersion, [operation], { skipPostProcess: true });
    const office = next.rooms.find((room) => room.id === "office-01");

    expect(office?.doors).toHaveLength(2);
    expect(office?.doors.at(-1)).toMatchObject({ wall: "east", position: 0.4, width: 1.1 });
  });

  it("skips operations that target locked rooms", () => {
    const operations: PlanOperation[] = [
      {
        id: "op-shift-office",
        type: "shift_rooms",
        label: "Shift office",
        targetRoomIds: ["office-01"],
        roomIds: ["office-01"],
        dx: 1,
        dy: 0
      },
      {
        id: "op-widen-corridor",
        type: "widen_corridor",
        label: "Widen corridor",
        targetRoomIds: ["corridor-01"],
        corridorIds: ["corridor-01"],
        extraWidthMeters: 0.4,
        side: "both"
      }
    ];

    expect(isOperationBlockedByLocks(operations[0]!, ["office-01"])).toBe(true);
    expect(isOperationBlockedByLocks(operations[1]!, ["office-01"])).toBe(false);

    const report = applyPlanOperationsWithReport(baseVersion, operations, {
      lockedElementIds: ["office-01"],
      skipPostProcess: true
    });

    expect(report.appliedOperationIds).toEqual(["op-widen-corridor"]);
    expect(report.skippedOperations).toHaveLength(1);
    expect(report.skippedOperations[0]?.lockedElementIds).toEqual(["office-01"]);
  });

  it("clamps oversized opening operations instead of trusting raw AI width", () => {
    const operation: PlanOperation = {
      id: "op-clamped-door",
      type: "add_opening",
      label: "Add wide door",
      targetRoomIds: ["office-01"],
      roomId: "office-01",
      openingKind: "door",
      wall: "east",
      position: 0.99,
      width: 20
    };

    const report = applyPlanOperationsWithReport(baseVersion, [operation], { skipPostProcess: true });
    const office = report.version.rooms.find((room) => room.id === "office-01");

    expect(report.appliedOperationIds).toEqual(["op-clamped-door"]);
    expect(office?.doors.at(-1)?.width).toBeLessThan(20);
  });
});
