import type { PlanVersion, Room } from "@/lib/project-types";
import { deriveVerticalElements } from "@/lib/vertical-elements";
import { getGridColumnPositions } from "@/lib/viewer-3d/building-model-utils";

const RETAINED_STRUCTURE_ROOM_TYPES = new Set<Room["type"]>(["stair", "elevator", "shaft", "equipment_room"]);

export interface RetainedStructureSummary {
  columnCount: number;
  verticalElementCount: number;
  preservedRooms: Array<{ id: string; name: string; type: Room["type"] }>;
}

export function isRetainedStructureRoom(room: Room): boolean {
  return RETAINED_STRUCTURE_ROOM_TYPES.has(room.type);
}

export function summarizeRetainedStructure(version: PlanVersion): RetainedStructureSummary {
  const preservedRooms = version.rooms.filter(isRetainedStructureRoom).map((room) => ({
    id: room.id,
    name: room.name,
    type: room.type
  }));

  return {
    columnCount: getGridColumnPositions(version).length,
    verticalElementCount: (version.verticalElements ?? deriveVerticalElements(version)).length,
    preservedRooms
  };
}

export function collectPreservedStructureRooms(
  version: PlanVersion,
  options: { preserveCores?: boolean } = {}
): Room[] {
  if (options.preserveCores === false) {
    return [];
  }

  return version.rooms.filter(isRetainedStructureRoom);
}
