import type { ComplianceFixPackage, ComplianceFixOptions } from "@/lib/compliance-fix";
import { getResolvedLevel } from "@/lib/level-rooms";
import type { PlanChangeProposal, PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";
import { measureCorridorsClearWidth } from "@/lib/rules/metrics/corridor-width";
import { checkDaylightCompliance } from "@/lib/rules/metrics/daylight-compliance";
import { computeEgressPathMetrics, computeWetCorePathMetrics } from "@/lib/rules/path-metrics";
import { ruleThreshold } from "@/lib/rules/rule-pack";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function nearestShaftId(rooms: Room[], fromRoom: Room) {
  const shafts = rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const from = centroid(fromRoom);

  return shafts
    .map((shaft) => ({ id: shaft.id, distance: distance(from, centroid(shaft)) }))
    .sort((left, right) => left.distance - right.distance)[0]?.id;
}

function shiftToward(from: Point, to: Point, meters: number): { dx: number; dy: number } {
  const deltaX = to[0] - from[0];
  const deltaY = to[1] - from[1];
  const length = Math.hypot(deltaX, deltaY);

  if (length < 0.01) {
    return { dx: 0, dy: 0 };
  }

  const scale = Math.min(meters, length) / length;
  return {
    dx: Number((deltaX * scale).toFixed(2)),
    dy: Number((deltaY * scale).toFixed(2))
  };
}

function buildCorridorWidthOperations(
  version: PlanVersion,
  fixPackage: ComplianceFixPackage,
  options: ComplianceFixOptions
): PlanOperation[] {
  const rulePack = resolveRulePack({ projectType: options.buildingType ?? "healthcare" });
  const resolved = getResolvedLevel(version, fixPackage.levelId);
  const rooms = resolved?.rooms ?? [];
  const corridorMinWidth = ruleThreshold(rulePack, "corridor-width", 1.2);
  const corridorRooms = rooms.filter((room) => room.type === "corridor");
  const narrowCorridors = measureCorridorsClearWidth(corridorRooms).filter(
    (item) => item.clearWidthM < corridorMinWidth
  );

  if (!narrowCorridors.length) {
    return [];
  }

  const narrowest = Math.min(...narrowCorridors.map((item) => item.clearWidthM));
  const extraWidthMeters = Number(Math.min(1.5, corridorMinWidth - narrowest + 0.15).toFixed(2));

  return [
    {
      id: "op-compliance-widen-corridor",
      type: "widen_corridor",
      label: `Widen corridors to ${corridorMinWidth}m clear width`,
      rationale: "Deterministic compliance fix for corridor-width rule.",
      targetRoomIds: narrowCorridors.map((item) => item.roomId),
      corridorIds: narrowCorridors.map((item) => item.roomId),
      extraWidthMeters,
      side: "both"
    }
  ];
}

function buildPlumbingOperations(
  version: PlanVersion,
  fixPackage: ComplianceFixPackage,
  options: ComplianceFixOptions
): PlanOperation[] {
  const rulePack = resolveRulePack({ projectType: options.buildingType ?? "healthcare" });
  const resolved = getResolvedLevel(version, fixPackage.levelId);
  const rooms = resolved?.rooms ?? [];
  const plumbingMaxDistance = rulePack.scoring.plumbingMaxDistanceM;
  const wetCoreMetrics = computeWetCorePathMetrics(version, fixPackage.levelId);
  const wetRoomIds = wetCoreMetrics.perRoom
    .filter((item) => item.distance > plumbingMaxDistance || (item.missingLinks?.length ?? 0) > 0)
    .map((item) => item.roomId);

  if (!wetRoomIds.length) {
    return [];
  }

  const wetRooms = rooms.filter((room) => wetRoomIds.includes(room.id));
  const nearShaftId = wetRooms.map((room) => nearestShaftId(rooms, room)).find(Boolean);

  return [
    {
      id: "op-compliance-align-wet",
      type: "align_wet_rooms",
      label: "Align wet rooms toward service shaft",
      rationale: "Deterministic compliance fix for plumbing-proximity rule.",
      targetRoomIds: wetRoomIds,
      roomIds: wetRoomIds,
      nearShaftId,
      maxDistanceMeters: plumbingMaxDistance
    }
  ];
}

function buildEgressOperations(version: PlanVersion, fixPackage: ComplianceFixPackage): PlanOperation[] {
  const resolved = getResolvedLevel(version, fixPackage.levelId);
  const rooms = resolved?.rooms ?? [];
  const egressMetrics = computeEgressPathMetrics(version, fixPackage.levelId);
  const corridorRooms = rooms.filter((room) => room.type === "corridor");
  const stairRooms = rooms.filter((room) => room.type === "stair" || room.type === "elevator");
  const worstRoom = rooms.find((room) => room.id === egressMetrics.worstRoomId);
  const operations: PlanOperation[] = [];

  if (corridorRooms.length) {
    operations.push({
      id: "op-compliance-widen-egress-corridor",
      type: "widen_corridor",
      label: "Widen egress corridors",
      rationale: "Improves egress travel distance by widening circulation paths.",
      targetRoomIds: corridorRooms.map((room) => room.id),
      corridorIds: corridorRooms.slice(0, 2).map((room) => room.id),
      extraWidthMeters: 0.5,
      side: "both"
    });
  }

  if (worstRoom && stairRooms.length) {
    const stair = stairRooms[0]!;
    const shift = shiftToward(centroid(worstRoom), centroid(stair), 2);

    if (shift.dx !== 0 || shift.dy !== 0) {
      operations.push({
        id: "op-compliance-shift-worst-room",
        type: "shift_rooms",
        label: `Shift ${worstRoom.name} toward egress core`,
        rationale: "Reduces egress distance for the worst served room.",
        targetRoomIds: [worstRoom.id],
        roomIds: [worstRoom.id],
        dx: shift.dx,
        dy: shift.dy
      });
    }
  }

  return operations;
}

function buildDaylightOperations(
  version: PlanVersion,
  fixPackage: ComplianceFixPackage,
  options: ComplianceFixOptions
): PlanOperation[] {
  const rulePack = resolveRulePack({ projectType: options.buildingType ?? "healthcare" });
  const resolved = getResolvedLevel(version, fixPackage.levelId);
  const rooms = resolved?.rooms ?? [];
  const daylightMaxDepth = rulePack.scoring.daylightMaxDepthM;
  const failingRooms = checkDaylightCompliance(
    version,
    rooms.filter((room) => room.needsDaylight),
    daylightMaxDepth
  ).filter((item) => !item.compliant);

  return failingRooms.slice(0, 4).map((item, index) => ({
    id: `op-compliance-daylight-${index + 1}`,
    type: "add_opening",
    label: `Add window for daylight (${item.roomName})`,
    rationale: "Deterministic compliance fix for daylight rule.",
    targetRoomIds: [item.roomId],
    roomId: item.roomId,
    openingKind: "window" as const,
    wall: "south" as const,
    position: 0.5,
    width: 1.8
  }));
}

function buildStairEgressWidthOperations(version: PlanVersion, fixPackage: ComplianceFixPackage): PlanOperation[] {
  const resolved = getResolvedLevel(version, fixPackage.levelId);
  const rooms = resolved?.rooms ?? [];
  const corridorRooms = rooms.filter((room) => room.type === "corridor");

  if (!corridorRooms.length) {
    return [];
  }

  return [
    {
      id: "op-compliance-stair-egress-width",
      type: "widen_corridor",
      label: "Widen stair-adjacent corridors",
      rationale: "Deterministic compliance fix for stair egress width.",
      targetRoomIds: corridorRooms.map((room) => room.id),
      corridorIds: corridorRooms.map((room) => room.id),
      extraWidthMeters: 0.6,
      side: "both"
    }
  ];
}

function buildEquipmentAlignmentOperations(version: PlanVersion, fixPackage: ComplianceFixPackage): PlanOperation[] {
  const resolved = getResolvedLevel(version, fixPackage.levelId);
  const rooms = resolved?.rooms ?? [];
  const shaftOrEquipmentRooms = rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const equipmentRooms = rooms.filter((room) => room.type === "equipment_room");
  const operations: PlanOperation[] = [];

  equipmentRooms.forEach((room, index) => {
    const nearestShaft = shaftOrEquipmentRooms
      .filter((target) => target.id !== room.id)
      .map((target) => ({ target, distance: distance(centroid(room), centroid(target)) }))
      .sort((left, right) => left.distance - right.distance)[0];

    if (!nearestShaft || nearestShaft.distance <= 10) {
      return;
    }

    const shift = shiftToward(centroid(room), centroid(nearestShaft.target), Math.min(3, nearestShaft.distance - 8));

    if (shift.dx === 0 && shift.dy === 0) {
      return;
    }

    operations.push({
      id: `op-compliance-shift-equipment-${index + 1}`,
      type: "shift_rooms",
      label: `Align ${room.name} with shaft`,
      rationale: "Deterministic compliance fix for equipment-shaft alignment.",
      targetRoomIds: [room.id],
      roomIds: [room.id],
      dx: shift.dx,
      dy: shift.dy
    });
  });

  return operations;
}

export function buildComplianceFixProposal(
  version: PlanVersion,
  fixPackage: ComplianceFixPackage,
  options: ComplianceFixOptions = {}
): PlanChangeProposal | undefined {
  let operations: PlanOperation[] = [];

  switch (fixPackage.ruleId) {
    case "corridor-width":
      operations = buildCorridorWidthOperations(version, fixPackage, options);
      break;
    case "plumbing-proximity":
      operations = buildPlumbingOperations(version, fixPackage, options);
      break;
    case "egress-distance":
      operations = buildEgressOperations(version, fixPackage);
      break;
    case "daylight":
      operations = buildDaylightOperations(version, fixPackage, options);
      break;
    case "stair-egress-width":
      operations = buildStairEgressWidthOperations(version, fixPackage);
      break;
    case "equipment-shaft-alignment":
      operations = buildEquipmentAlignmentOperations(version, fixPackage);
      break;
    default:
      return undefined;
  }

  if (!operations.length) {
    return undefined;
  }

  const filtered = operations.filter((operation) => {
    const targets =
      operation.type === "shift_rooms"
        ? operation.roomIds
        : operation.type === "widen_corridor"
          ? operation.corridorIds ?? []
          : operation.type === "align_wet_rooms"
            ? operation.roomIds ?? []
            : operation.type === "add_opening"
              ? [operation.roomId]
              : operation.targetRoomIds;

    return targets.every((roomId) => fixPackage.allowedRoomIds.includes(roomId));
  });

  if (!filtered.length) {
    return undefined;
  }

  return {
    intent: fixPackage.userRequest,
    constraints: [
      {
        id: "constraint-region",
        label: "Keep edits inside the compliance fix region",
        severity: "hard"
      }
    ],
    targetElementIds: fixPackage.highlightRoomIds,
    operations: filtered
  };
}
