import { getResolvedLevel } from "@/lib/level-rooms";
import type { RoomChangeSummary } from "@/lib/plan-change-diff";
import { summarizeRoomChanges } from "@/lib/plan-change-diff";
import type { PlanVersion, Room } from "@/lib/project-types";

export type { RoomChangeSummary };

export function roomsForCompareLevel(version: PlanVersion, levelId?: string): Room[] {
  if (!levelId) {
    return version.rooms;
  }

  return getResolvedLevel(version, levelId)?.rooms ?? version.rooms;
}

export function summarizeRoomChangesAtLevel(
  base: PlanVersion,
  preview: PlanVersion,
  levelId?: string
): RoomChangeSummary {
  if (!levelId) {
    return summarizeRoomChanges(base, preview);
  }

  const baseSlice: PlanVersion = {
    ...base,
    rooms: roomsForCompareLevel(base, levelId)
  };
  const previewSlice: PlanVersion = {
    ...preview,
    rooms: roomsForCompareLevel(preview, levelId)
  };

  return summarizeRoomChanges(baseSlice, previewSlice);
}

export function countGeometryDiffChanges(summary: RoomChangeSummary) {
  return summary.added.length + summary.modified.length + summary.removed.length;
}
