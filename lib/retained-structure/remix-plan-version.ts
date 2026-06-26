import { normalizePlanVersion } from "@/lib/architecture-model";
import { applyLevelRoomsToVersion } from "@/lib/level-rooms";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { relayoutPlanVersion, type RelayoutPlanVersionOptions } from "@/lib/relayout-version";
import type { PlanVersion } from "@/lib/project-types";
import { syncVerticalElements } from "@/lib/vertical-elements";
import {
  collectPreservedStructureRooms,
  isRetainedStructureRoom
} from "@/lib/retained-structure/structure-rooms";

export interface RetainedStructureRemixOptions extends RelayoutPlanVersionOptions {
  preserveColumns?: boolean;
  preserveCores?: boolean;
}

function mergePreservedStructureRooms(
  relaid: PlanVersion,
  preservedRooms: PlanVersion["rooms"]
): PlanVersion["rooms"] {
  const preservedIds = new Set(preservedRooms.map((room) => room.id));

  return [
    ...preservedRooms,
    ...relaid.rooms.filter((room) => !preservedIds.has(room.id) && !isRetainedStructureRoom(room))
  ];
}

export function remixPlanWithRetainedStructure(
  version: PlanVersion,
  options: RetainedStructureRemixOptions = {}
): PlanVersion {
  const preserveColumns = options.preserveColumns !== false;
  const preserveCores = options.preserveCores !== false;
  const preservedRooms = collectPreservedStructureRooms(version, { preserveCores });
  const relaid = relayoutPlanVersion(version, options);
  const floorCount = version.metadata?.floorCount ?? version.levels.length;
  const mergedRooms = mergePreservedStructureRooms(relaid, preservedRooms);
  const levelId = relaid.levels[0]?.id;

  const remixDraft: PlanVersion = {
    ...relaid,
    id: version.id,
    label: version.label,
    createdAt: version.createdAt,
    parentVersionId: version.parentVersionId,
    rooms: mergedRooms,
    building: preserveColumns ? version.building : relaid.building,
    metadata: {
      ...relaid.metadata,
      retainedStructureRemixAt: new Date().toISOString(),
      preservedStructureRoomIds: preservedRooms.map((room) => room.id),
      preservedColumnGrid: preserveColumns
    },
    verticalElements: undefined,
    mep: undefined
  };

  let remixed = levelId ? applyLevelRoomsToVersion(remixDraft, levelId, mergedRooms) ?? remixDraft : remixDraft;

  if (preserveColumns && version.building?.grids?.length) {
    remixed = {
      ...remixed,
      building: {
        ...remixed.building,
        grids: version.building.grids
      }
    };
  }

  const expanded = floorCount > 1 ? expandPlanVersionToFloors(remixed, floorCount) : remixed;
  return syncVerticalElements(normalizePlanVersion(expanded));
}
