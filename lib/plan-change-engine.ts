import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { polygonArea } from "@/lib/plan-validation";
import type { PlanOperation, PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

const CORE_TYPES = new Set(["stair", "elevator", "shaft"]);
const WET_TYPES = new Set(["bathroom", "kitchen"]);
const CORRIDOR_TYPE = "corridor";

function shiftPolygon(points: Point[], dx: number, dy: number): Point[] {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) {
    return [0, 0];
  }

  const sum = points.reduce(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point,
    [0, 0] as Point
  );

  return [sum[0] / points.length, sum[1] / points.length];
}

function directionDelta(direction: "north" | "south" | "east" | "west", distance: number): { dx: number; dy: number } {
  switch (direction) {
    case "north":
      return { dx: 0, dy: -distance };
    case "south":
      return { dx: 0, dy: distance };
    case "east":
      return { dx: distance, dy: 0 };
    case "west":
      return { dx: -distance, dy: 0 };
  }
}

function roomBounds(polygon: Point[]) {
  return polygon.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

function widenRectPolygon(polygon: Point[], extraWidth: number, side: "left" | "right" | "both"): Point[] {
  const bounds = roomBounds(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const horizontal = width >= height;
  const half = extraWidth / 2;

  if (horizontal) {
    const left = side === "right" ? 0 : side === "both" ? half : extraWidth;
    const right = side === "left" ? 0 : side === "both" ? half : extraWidth;
    return [
      [bounds.minX - left, bounds.minY],
      [bounds.maxX + right, bounds.minY],
      [bounds.maxX + right, bounds.maxY],
      [bounds.minX - left, bounds.maxY]
    ];
  }

  const top = side === "right" ? 0 : side === "both" ? half : extraWidth;
  const bottom = side === "left" ? 0 : side === "both" ? half : extraWidth;
  return [
    [bounds.minX, bounds.minY - top],
    [bounds.maxX, bounds.minY - top],
    [bounds.maxX, bounds.maxY + bottom],
    [bounds.minX, bounds.maxY + bottom]
  ];
}

function updateRoomInVersion(version: PlanVersion, roomId: string, updater: (room: Room) => Room): PlanVersion {
  const nextLevels = version.levels.map((level) => ({
    ...level,
    rooms: level.rooms.map((room) => (room.id === roomId ? updater(room) : room))
  }));

  return {
    ...version,
    rooms: nextLevels.flatMap((level) => level.rooms),
    levels: nextLevels,
    building: {
      ...version.building,
      levels: nextLevels
    }
  };
}

function updateRoomsInVersion(
  version: PlanVersion,
  roomIds: Set<string>,
  updater: (room: Room) => Room
): PlanVersion {
  let next = version;

  roomIds.forEach((roomId) => {
    next = updateRoomInVersion(next, roomId, updater);
  });

  return next;
}

function applyMoveCore(version: PlanVersion, operation: Extract<PlanOperation, { type: "move_core" }>): PlanVersion {
  const { dx, dy } = directionDelta(operation.direction, operation.distanceMeters);
  const coreIds = new Set(
    version.rooms.filter((room) => CORE_TYPES.has(room.type)).map((room) => room.id)
  );

  return updateRoomsInVersion(version, coreIds, (room) => ({
    ...room,
    polygon: shiftPolygon(room.polygon, dx, dy),
    areaSqm: Number(polygonArea(shiftPolygon(room.polygon, dx, dy)).toFixed(1))
  }));
}

function applyShiftRooms(version: PlanVersion, operation: Extract<PlanOperation, { type: "shift_rooms" }>): PlanVersion {
  const ids = new Set(operation.roomIds);

  return updateRoomsInVersion(version, ids, (room) => ({
    ...room,
    polygon: shiftPolygon(room.polygon, operation.dx, operation.dy),
    areaSqm: Number(polygonArea(shiftPolygon(room.polygon, operation.dx, operation.dy)).toFixed(1))
  }));
}

function applyWidenCorridor(
  version: PlanVersion,
  operation: Extract<PlanOperation, { type: "widen_corridor" }>
): PlanVersion {
  const corridorIds = new Set(
    operation.corridorIds?.length
      ? operation.corridorIds
      : version.rooms.filter((room) => room.type === CORRIDOR_TYPE).map((room) => room.id)
  );

  return updateRoomsInVersion(version, corridorIds, (room) => {
    const polygon = widenRectPolygon(room.polygon, operation.extraWidthMeters, operation.side);
    return {
      ...room,
      polygon,
      areaSqm: Number(polygonArea(polygon).toFixed(1))
    };
  });
}

function applyAlignWetRooms(
  version: PlanVersion,
  operation: Extract<PlanOperation, { type: "align_wet_rooms" }>
): PlanVersion {
  const shafts = version.rooms.filter((room) => room.type === "shaft");
  const shaft =
    (operation.nearShaftId ? version.rooms.find((room) => room.id === operation.nearShaftId) : undefined) ??
    shafts[0];

  if (!shaft) {
    return version;
  }

  const shaftCenter = polygonCentroid(shaft.polygon);
  const wetIds = new Set(
    operation.roomIds?.length
      ? operation.roomIds
      : version.rooms.filter((room) => WET_TYPES.has(room.type) || room.needsPlumbing).map((room) => room.id)
  );

  return updateRoomsInVersion(version, wetIds, (room) => {
    const center = polygonCentroid(room.polygon);
    const dx = shaftCenter[0] - center[0];
    const dy = shaftCenter[1] - center[1];
    const distance = Math.hypot(dx, dy);

    if (distance < 0.01 || distance <= (operation.maxDistanceMeters ?? 12)) {
      return room;
    }

    const step = Math.min(distance * 0.35, distance - (operation.maxDistanceMeters ?? 12) * 0.5);
    const scale = step / distance;
    const nextPolygon = shiftPolygon(room.polygon, dx * scale, dy * scale);

    return {
      ...room,
      polygon: nextPolygon,
      areaSqm: Number(polygonArea(nextPolygon).toFixed(1))
    };
  });
}

function applyUpdateRoom(version: PlanVersion, operation: Extract<PlanOperation, { type: "update_room" }>): PlanVersion {
  return updateRoomInVersion(version, operation.roomId, (room) => ({
    ...room,
    ...(operation.patch.name ? { name: operation.patch.name } : {}),
    ...(operation.patch.type ? { type: operation.patch.type as Room["type"] } : {}),
    ...(operation.patch.zone ? { zone: operation.patch.zone as Room["zone"] } : {})
  }));
}

function applyOptimizeEgress(
  version: PlanVersion,
  operation: Extract<PlanOperation, { type: "optimize_egress" }>
): PlanVersion {
  return {
    ...version,
    metadata: {
      ...version.metadata,
      refinementSummary: operation.note ?? operation.label
    }
  };
}

function applyOperation(version: PlanVersion, operation: PlanOperation): PlanVersion {
  switch (operation.type) {
    case "move_core":
      return applyMoveCore(version, operation);
    case "shift_rooms":
      return applyShiftRooms(version, operation);
    case "widen_corridor":
      return applyWidenCorridor(version, operation);
    case "align_wet_rooms":
      return applyAlignWetRooms(version, operation);
    case "update_room":
      return applyUpdateRoom(version, operation);
    case "optimize_egress":
      return applyOptimizeEgress(version, operation);
    default:
      return version;
  }
}

export interface ApplyPlanOperationsOptions {
  acceptedOperationIds?: string[];
  skipPostProcess?: boolean;
}

export function applyPlanOperations(
  baseVersion: PlanVersion,
  operations: PlanOperation[],
  options: ApplyPlanOperationsOptions = {}
): PlanVersion {
  const accepted = options.acceptedOperationIds
    ? operations.filter((operation) => options.acceptedOperationIds!.includes(operation.id))
    : operations;

  const reduced = accepted.reduce((version, operation) => applyOperation(version, operation), baseVersion);

  if (options.skipPostProcess) {
    return reduced;
  }

  return postProcessPlanVersion(reduced);
}

export function buildPreviewVersion(
  baseVersion: PlanVersion,
  proposal: PlanChangeProposal,
  options?: { acceptedOperationIds?: string[]; versionLabel?: string }
): PlanVersion {
  const applied = applyPlanOperations(baseVersion, proposal.operations, {
    acceptedOperationIds: options?.acceptedOperationIds
  });

  return {
    ...applied,
    id: `${baseVersion.id}-proposal-${Date.now()}`,
    label: options?.versionLabel ?? `${baseVersion.label} / Copilot Proposal`,
    createdAt: new Date().toISOString(),
    parentVersionId: baseVersion.id,
    metadata: {
      ...applied.metadata,
      strategy: proposal.intent,
      refinementSummary: `Copilot proposal: ${proposal.intent}`
    }
  };
}

export function operationSummary(operation: PlanOperation): string {
  switch (operation.type) {
    case "move_core":
      return `Move core ${operation.direction} by ${operation.distanceMeters}m`;
    case "shift_rooms":
      return `Shift ${operation.roomIds.length} room(s) by (${operation.dx}, ${operation.dy})m`;
    case "widen_corridor":
      return `Widen corridor by ${operation.extraWidthMeters}m (${operation.side})`;
    case "align_wet_rooms":
      return `Align wet rooms toward shaft`;
    case "update_room":
      return `Update room ${operation.roomId}`;
    case "optimize_egress":
      return operation.note ?? operation.label;
  }
}
