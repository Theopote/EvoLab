import type { PlanTopologyVersion, TopologyRoom } from "@/lib/schemas/plan-version-schema";
import type { PlanVersion } from "@/lib/project-types";
import {
  functionalTypeToTypologyPackId,
  type RetainedStructureRemixParameters,
  type RemixCorridorStrategy
} from "@/lib/retained-structure/remix-parameters";
import { isRetainedStructureRoom } from "@/lib/retained-structure/structure-rooms";
import { buildTopologyEdgesFromPack, buildTopologyRoomsFromStrategy } from "@/lib/typology/topology";
import { TYPOLOGY_PACK_BY_ID } from "@/lib/typology/packs";
import type { TopologyRoomTemplate, TopologyStrategyTemplate } from "@/lib/typology/types";

const STRUCTURE_ROOM_TYPES = new Set(["stair", "elevator", "shaft", "equipment_room"]);

const COMMERCIAL_ROOM_TEMPLATES: TopologyRoomTemplate[] = [
  { id: "lobby-01", name: "商业门厅", roomType: "lobby", zone: "public", areaShare: 0.14, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
  { id: "corridor-01", name: "商业内街", roomType: "corridor", zone: "circulation", areaShare: 0.12, preferredEdge: "interior", adjacencyIds: ["lobby-01", "retail-01", "retail-02"] },
  { id: "retail-01", name: "主力店 A", roomType: "other", zone: "semi_public", areaShare: 0.32, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
  { id: "retail-02", name: "主力店 B", roomType: "other", zone: "semi_public", areaShare: 0.28, needsDaylight: true, preferredEdge: "north", adjacencyIds: ["corridor-01"] },
  { id: "back-01", name: "后勤区", roomType: "equipment_room", zone: "service", areaShare: 0.14, preferredEdge: "interior", adjacencyIds: ["corridor-01"] }
];

const EXHIBITION_ROOM_TEMPLATES: TopologyRoomTemplate[] = [
  { id: "lobby-01", name: "展陈门厅", roomType: "lobby", zone: "public", areaShare: 0.12, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
  { id: "corridor-01", name: "展陈环廊", roomType: "corridor", zone: "circulation", areaShare: 0.1, preferredEdge: "interior", adjacencyIds: ["lobby-01", "hall-01", "hall-02"] },
  { id: "hall-01", name: "主展厅", roomType: "other", zone: "semi_public", areaShare: 0.42, needsDaylight: true, preferredEdge: "south", adjacencyIds: ["corridor-01"] },
  { id: "hall-02", name: "专题展厅", roomType: "other", zone: "semi_public", areaShare: 0.24, needsDaylight: true, preferredEdge: "north", adjacencyIds: ["corridor-01"] },
  { id: "service-01", name: "设备间", roomType: "equipment_room", zone: "service", areaShare: 0.12, preferredEdge: "interior", adjacencyIds: ["corridor-01"] }
];

function grossAreaSqm(version: PlanVersion) {
  if (version.overallBounds) {
    return Math.max(120, version.overallBounds.width * version.overallBounds.height);
  }

  return Math.max(120, version.rooms.reduce((sum, room) => sum + room.areaSqm, 0));
}

function strategyForCorridor(packStrategies: TopologyStrategyTemplate[], corridorStrategy: RemixCorridorStrategy) {
  const byKind = (kind: TopologyStrategyTemplate["layoutKind"]) =>
    packStrategies.find((strategy) => strategy.layoutKind === kind) ?? packStrategies[0]!;

  switch (corridorStrategy) {
    case "open":
      return byKind("open_plan");
    case "side":
      return byKind("side_core");
    case "ring":
      return byKind("dual_corridor");
    case "central":
    default:
      return byKind("central_core");
  }
}

function buildProgramRooms(parameters: RetainedStructureRemixParameters, grossArea: number): TopologyRoom[] {
  const packId = functionalTypeToTypologyPackId(parameters.targetFunctionalType);
  const pack = TYPOLOGY_PACK_BY_ID[packId];
  const strategy = strategyForCorridor(pack.topology.strategies, parameters.corridorStrategy);

  if (parameters.targetFunctionalType === "commercial") {
    return buildRoomsFromCustomTemplates(COMMERCIAL_ROOM_TEMPLATES, grossArea, strategy);
  }

  if (parameters.targetFunctionalType === "exhibition") {
    return buildRoomsFromCustomTemplates(EXHIBITION_ROOM_TEMPLATES, grossArea, strategy);
  }

  return buildTopologyRoomsFromStrategy(pack, strategy, grossArea);
}

function buildRoomsFromCustomTemplates(
  templates: TopologyRoomTemplate[],
  grossArea: number,
  strategy: TopologyStrategyTemplate
) {
  void strategy;
  const totalShare = templates.reduce((sum, template) => sum + template.areaShare, 0) || 1;

  return templates.map((template) => {
    const normalizedShare = template.areaShare / totalShare;
    return {
      id: template.id,
      name: template.name,
      type: template.roomType,
      zone: template.zone,
      targetAreaSqm: Math.max(12, Math.round(grossArea * normalizedShare)),
      ceilingHeight: template.roomType === "lobby" ? 5.2 : template.roomType === "equipment_room" ? 3.6 : 3.3,
      needsDaylight: template.needsDaylight ?? template.zone !== "service",
      needsPlumbing: template.needsPlumbing ?? false,
      preferredEdge: template.preferredEdge ?? "south",
      adjacencyIds: template.adjacencyIds ?? []
    };
  });
}

function isProgramRoom(room: TopologyRoom) {
  return !STRUCTURE_ROOM_TYPES.has(room.type) && room.type !== "corridor" && room.type !== "lobby";
}

function isPublicProgramRoom(room: TopologyRoom) {
  return room.type === "corridor" || room.type === "lobby" || room.zone === "public" || room.zone === "semi_public";
}

function applyPublicAreaRatio(rooms: TopologyRoom[], publicAreaRatio: number) {
  const publicRooms = rooms.filter(isPublicProgramRoom);
  const privateRooms = rooms.filter((room) => !isPublicProgramRoom(room));
  const totalArea = rooms.reduce((sum, room) => sum + room.targetAreaSqm, 0);
  const targetPublicArea = totalArea * publicAreaRatio;
  const currentPublicArea = publicRooms.reduce((sum, room) => sum + room.targetAreaSqm, 0) || 1;
  const publicScale = targetPublicArea / currentPublicArea;
  const scaledPublicTotal = publicRooms.reduce(
    (sum, room) => sum + Math.max(8, Math.round(room.targetAreaSqm * publicScale)),
    0
  );
  const privateBudget = Math.max(24, totalArea - scaledPublicTotal);
  const privateTotal = privateRooms.reduce((sum, room) => sum + room.targetAreaSqm, 0) || 1;
  const privateScale = privateBudget / privateTotal;

  return rooms.map((room) => {
    if (isPublicProgramRoom(room)) {
      return {
        ...room,
        targetAreaSqm: Math.max(8, Math.round(room.targetAreaSqm * publicScale))
      };
    }

    return {
      ...room,
      targetAreaSqm: Math.max(12, Math.round(room.targetAreaSqm * privateScale))
    };
  });
}

function splitLargestRoom(rooms: TopologyRoom[], index: number): TopologyRoom[] {
  const candidates = rooms.filter(isProgramRoom);
  if (!candidates.length) {
    return rooms;
  }

  const largest = [...candidates].sort((left, right) => right.targetAreaSqm - left.targetAreaSqm)[0]!;
  const splitArea = Math.max(12, Math.round(largest.targetAreaSqm / 2));
  const newRoom: TopologyRoom = {
    ...largest,
    id: `${largest.id}-split-${index + 1}`,
    name: `${largest.name} ${index + 1}`,
    targetAreaSqm: splitArea
  };

  return rooms.flatMap((room) => {
    if (room.id !== largest.id) {
      return [room];
    }

    return [
      { ...room, targetAreaSqm: splitArea },
      newRoom
    ];
  });
}

function mergeSmallestRooms(rooms: TopologyRoom[]): TopologyRoom[] {
  const candidates = [...rooms.filter(isProgramRoom)].sort((left, right) => left.targetAreaSqm - right.targetAreaSqm);
  if (candidates.length < 2) {
    return rooms;
  }

  const first = candidates[0]!;
  const second = candidates[1]!;
  const merged: TopologyRoom = {
    ...first,
    id: `${first.id}-${second.id}`,
    name: `${first.name} / ${second.name}`,
    targetAreaSqm: first.targetAreaSqm + second.targetAreaSqm,
    adjacencyIds: Array.from(new Set([...(first.adjacencyIds ?? []), ...(second.adjacencyIds ?? [])]))
  };

  return rooms.filter((room) => room.id !== first.id && room.id !== second.id).concat(merged);
}

function adjustProgramRoomCount(rooms: TopologyRoom[], targetCount: number, allowSplitLargeRooms: boolean) {
  let next = [...rooms];
  const countProgramRooms = () => next.filter(isProgramRoom).length;

  while (countProgramRooms() < targetCount) {
    if (!allowSplitLargeRooms) {
      break;
    }

    next = splitLargestRoom(next, countProgramRooms());
  }

  while (countProgramRooms() > targetCount) {
    next = mergeSmallestRooms(next);
  }

  return next;
}

function stripCorridorForOpenPlan(rooms: TopologyRoom[], corridorStrategy: RemixCorridorStrategy) {
  if (corridorStrategy !== "open") {
    return rooms;
  }

  return rooms.filter((room) => room.type !== "corridor");
}

function preservedStructureTopologyRooms(version: PlanVersion, preserveCores: boolean) {
  if (!preserveCores) {
    return [];
  }

  return version.rooms.filter(isRetainedStructureRoom).map((room) => ({
    id: room.id,
    name: room.name,
    type: room.type,
    zone: room.zone,
    targetAreaSqm: Math.max(6, room.areaSqm),
    ceilingHeight: room.ceilingHeight,
    needsDaylight: room.needsDaylight ?? false,
    needsPlumbing: room.needsPlumbing ?? false,
    preferredEdge: (room.orientation ?? "interior") as TopologyRoom["preferredEdge"],
    adjacencyIds: room.adjacents ?? []
  }));
}

export function adaptTopologyForRemix(
  sourceTopology: PlanTopologyVersion,
  version: PlanVersion,
  parameters: RetainedStructureRemixParameters
): PlanTopologyVersion {
  const packId = functionalTypeToTypologyPackId(parameters.targetFunctionalType);
  const pack = TYPOLOGY_PACK_BY_ID[packId];
  const strategy = strategyForCorridor(pack.topology.strategies, parameters.corridorStrategy);
  const grossArea = grossAreaSqm(version);

  let programRooms = buildProgramRooms(parameters, grossArea);
  programRooms = applyPublicAreaRatio(programRooms, parameters.publicAreaRatio);
  programRooms = adjustProgramRoomCount(
    programRooms,
    parameters.targetRoomCount,
    parameters.allowSplitLargeRooms
  );
  programRooms = stripCorridorForOpenPlan(programRooms, parameters.corridorStrategy);

  const preservedRooms = preservedStructureTopologyRooms(version, parameters.preserveCores);
  const preservedIds = new Set(preservedRooms.map((room) => room.id));
  const rooms = [...preservedRooms, ...programRooms.filter((room) => !preservedIds.has(room.id))];
  const edges = buildTopologyEdgesFromPack(pack, rooms);

  return {
    ...sourceTopology,
    label: `${sourceTopology.label} · ${REMIX_FUNCTIONAL_LABEL(parameters.targetFunctionalType)}重划`,
    strategy: `${strategy.label} / ${parameters.corridorStrategy}`,
    topology: {
      circulation: strategy.circulation,
      core: strategy.core,
      daylight:
        parameters.layoutPriority === "daylight"
          ? "Perimeter bands prioritize daylit program rooms."
          : strategy.daylight,
      plumbing: strategy.plumbing
    },
    rooms,
    edges
  };
}

function REMIX_FUNCTIONAL_LABEL(type: RetainedStructureRemixParameters["targetFunctionalType"]) {
  switch (type) {
    case "office":
      return "办公";
    case "medical":
      return "医疗";
    case "commercial":
      return "商业";
    case "residential":
      return "住宅";
    case "exhibition":
      return "展陈";
  }
}
