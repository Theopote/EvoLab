import { normalizePlanVersion } from "@/lib/architecture-model";
import { applyLevelRoomsToVersion } from "@/lib/level-rooms";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { extractTopologyFromVersion, relayoutPlanVersion, type RelayoutPlanVersionOptions } from "@/lib/relayout-version";
import type { PlanVersion } from "@/lib/project-types";
import { syncVerticalElements } from "@/lib/vertical-elements";
import { adaptTopologyForRemix } from "@/lib/retained-structure/adapt-topology-for-remix";
import {
  defaultRemixParameters,
  remixParametersToRecord,
  type RetainedStructureRemixParameters
} from "@/lib/retained-structure/remix-parameters";
import {
  collectPreservedStructureRooms,
  isRetainedStructureRoom
} from "@/lib/retained-structure/structure-rooms";

export type ResolvedRetainedStructureRemixOptions = RelayoutPlanVersionOptions & RetainedStructureRemixParameters;

export function resolveRetainedStructureRemixOptions(
  version: PlanVersion,
  options: Partial<ResolvedRetainedStructureRemixOptions> = {}
): ResolvedRetainedStructureRemixOptions {
  const relayoutableRoomCount = version.rooms.filter((room) => !isRetainedStructureRoom(room)).length;
  const defaults = defaultRemixParameters({ relayoutableRoomCount });

  return {
    ...defaults,
    siteOutline: options.siteOutline ?? options.layoutOutline ?? version.outline,
    layoutOutline: options.layoutOutline ?? options.siteOutline ?? version.outline,
    ...options,
    targetRoomCount:
      typeof options.targetRoomCount === "number" ? options.targetRoomCount : defaults.targetRoomCount,
    publicAreaRatio:
      typeof options.publicAreaRatio === "number" ? options.publicAreaRatio : defaults.publicAreaRatio
  };
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
  options: Partial<ResolvedRetainedStructureRemixOptions> = {}
): PlanVersion {
  const resolved = resolveRetainedStructureRemixOptions(version, options);
  const sourceTopology = extractTopologyFromVersion(version);
  if (!sourceTopology) {
    throw new Error("Cannot remix: active version has no stored or reconstructable topology graph.");
  }

  const adaptedTopology = adaptTopologyForRemix(sourceTopology, version, resolved);
  const preserveColumns = resolved.preserveColumns !== false;
  const preserveCores = resolved.preserveCores !== false;
  const preservedRooms = collectPreservedStructureRooms(version, { preserveCores });
  const relaid = relayoutPlanVersion(version, {
    ...resolved,
    topologyOverride: adaptedTopology,
    corridorStrategy: resolved.corridorStrategy,
    layoutPriority: resolved.layoutPriority,
    lockExteriorWindows: resolved.lockExteriorWindows
  });
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
      preservedColumnGrid: preserveColumns,
      remixParameters: remixParametersToRecord(resolved)
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
