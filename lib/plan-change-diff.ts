import type { PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";
import type { PlanVersion } from "@/lib/project-types";

export interface RoomChangeSummary {
  modified: string[];
  added: string[];
  removed: string[];
}

export function getOperationTargetIds(operation: PlanOperation): string[] {
  if (operation.targetRoomIds.length) {
    return operation.targetRoomIds;
  }

  switch (operation.type) {
    case "shift_rooms":
      return operation.roomIds;
    case "update_room":
    case "split_room":
    case "add_opening":
    case "resize_opening":
      return [operation.roomId];
    case "widen_corridor":
      return operation.corridorIds ?? [];
    case "align_wet_rooms":
      return operation.roomIds ?? [];
    case "move_core":
    case "optimize_egress":
      return [];
    default:
      return [];
  }
}

export function summarizeRoomChanges(base: PlanVersion, preview: PlanVersion): RoomChangeSummary {
  const baseIds = new Set(base.rooms.map((room) => room.id));
  const previewIds = new Set(preview.rooms.map((room) => room.id));

  const added = preview.rooms.filter((room) => !baseIds.has(room.id)).map((room) => room.id);
  const removed = base.rooms.filter((room) => !previewIds.has(room.id)).map((room) => room.id);
  const modified = preview.rooms
    .filter((room) => {
      if (!baseIds.has(room.id)) {
        return false;
      }

      const previous = base.rooms.find((item) => item.id === room.id);

      if (!previous) {
        return false;
      }

      return (
        previous.areaSqm !== room.areaSqm ||
        previous.name !== room.name ||
        previous.type !== room.type ||
        previous.zone !== room.zone ||
        JSON.stringify(previous.polygon) !== JSON.stringify(room.polygon) ||
        JSON.stringify(previous.doors) !== JSON.stringify(room.doors) ||
        JSON.stringify(previous.windows) !== JSON.stringify(room.windows)
      );
    })
    .map((room) => room.id);

  return { modified, added, removed };
}

export function getHighlightedRoomIds(
  base: PlanVersion,
  preview: PlanVersion,
  operationIds: string[],
  operations: PlanOperation[]
): string[] {
  const selected = new Set(
    operations.filter((operation) => operationIds.includes(operation.id)).flatMap(getOperationTargetIds)
  );
  const changes = summarizeRoomChanges(base, preview);

  return [...new Set([...selected, ...changes.modified, ...changes.added, ...changes.removed])];
}
