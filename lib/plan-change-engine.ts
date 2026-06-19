import { getOperationTargetIds } from "@/lib/plan-change-diff";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { polygonArea } from "@/lib/plan-validation";
import type { PlanChangeProposal, PlanOperation } from "@/lib/schemas/plan-change-proposal-schema";
import type { Opening, PlanVersion, Point, Room } from "@/lib/project-types";
import {
  sanitizeAddOpeningOperation,
  sanitizeResizeOpeningOperation
} from "@/lib/opening-constraints";

const CORE_TYPES = new Set(["stair", "elevator", "shaft"]);
const WET_TYPES = new Set(["bathroom", "kitchen"]);
const CORRIDOR_TYPE = "corridor";

export interface SkippedPlanOperation {
  operationId: string;
  label: string;
  lockedElementIds: string[];
  reason?: string;
}

export interface PlanOperationsReport {
  version: PlanVersion;
  appliedOperationIds: string[];
  skippedOperations: SkippedPlanOperation[];
}

export interface ApplyPlanOperationsOptions {
  acceptedOperationIds?: string[];
  lockedElementIds?: string[];
  skipPostProcess?: boolean;
}

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

function replaceRoomsInVersion(version: PlanVersion, nextRooms: Room[]): PlanVersion {
  const nextLevels = version.levels.map((level, index) => ({
    ...level,
    rooms: index === 0 ? nextRooms : level.rooms.filter((room) => nextRooms.some((item) => item.id === room.id))
  }));

  return {
    ...version,
    rooms: nextRooms,
    levels: nextLevels,
    building: {
      ...version.building,
      levels: nextLevels
    }
  };
}

function updateRoomInVersion(version: PlanVersion, roomId: string, updater: (room: Room) => Room): PlanVersion {
  const nextRooms = version.rooms.map((room) => (room.id === roomId ? updater(room) : room));
  return replaceRoomsInVersion(version, nextRooms);
}

function updateRoomsInVersion(
  version: PlanVersion,
  roomIds: Set<string>,
  updater: (room: Room) => Room
): PlanVersion {
  const nextRooms = version.rooms.map((room) => (roomIds.has(room.id) ? updater(room) : room));
  return replaceRoomsInVersion(version, nextRooms);
}

function splitRectRoom(
  room: Room,
  axis: "horizontal" | "vertical",
  ratio: number,
  secondRoom: { id: string; name: string }
): { first: Room; second: Room } | undefined {
  const bounds = roomBounds(room.polygon);
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;

  if (spanX < 2 || spanY < 2) {
    return undefined;
  }

  if (axis === "vertical") {
    const cutX = bounds.minX + spanX * ratio;
    const firstPolygon: Point[] = [
      [bounds.minX, bounds.minY],
      [cutX, bounds.minY],
      [cutX, bounds.maxY],
      [bounds.minX, bounds.maxY]
    ];
    const secondPolygon: Point[] = [
      [cutX, bounds.minY],
      [bounds.maxX, bounds.minY],
      [bounds.maxX, bounds.maxY],
      [cutX, bounds.maxY]
    ];

    return {
      first: {
        ...room,
        polygon: firstPolygon,
        areaSqm: Number(polygonArea(firstPolygon).toFixed(1))
      },
      second: {
        ...room,
        id: secondRoom.id,
        name: secondRoom.name,
        polygon: secondPolygon,
        areaSqm: Number(polygonArea(secondPolygon).toFixed(1)),
        doors: [],
        windows: [],
        adjacents: room.adjacents
      }
    };
  }

  const cutY = bounds.minY + spanY * ratio;
  const firstPolygon: Point[] = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.maxX, cutY],
    [bounds.minX, cutY]
  ];
  const secondPolygon: Point[] = [
    [bounds.minX, cutY],
    [bounds.maxX, cutY],
    [bounds.maxX, bounds.maxY],
    [bounds.minX, bounds.maxY]
  ];

  return {
    first: {
      ...room,
      polygon: firstPolygon,
      areaSqm: Number(polygonArea(firstPolygon).toFixed(1))
    },
    second: {
      ...room,
      id: secondRoom.id,
      name: secondRoom.name,
      polygon: secondPolygon,
      areaSqm: Number(polygonArea(secondPolygon).toFixed(1)),
      doors: [],
      windows: [],
      adjacents: room.adjacents
    }
  };
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

function applySplitRoom(version: PlanVersion, operation: Extract<PlanOperation, { type: "split_room" }>): PlanVersion {
  const room = version.rooms.find((item) => item.id === operation.roomId);

  if (!room) {
    return version;
  }

  const secondRoomId = operation.secondRoomId ?? `${operation.roomId}-split-b`;
  const split = splitRectRoom(room, operation.splitAxis, operation.splitRatio, {
    id: secondRoomId,
    name: operation.secondRoomName
  });

  if (!split) {
    return version;
  }

  const nextRooms = version.rooms.flatMap((item) => {
    if (item.id !== operation.roomId) {
      return [item];
    }

    return [split.first, split.second];
  });

  return replaceRoomsInVersion(version, nextRooms);
}

function applyAddOpening(version: PlanVersion, operation: Extract<PlanOperation, { type: "add_opening" }>): PlanVersion {
  const sanitized = sanitizeAddOpeningOperation(version, operation);

  if (!sanitized) {
    return version;
  }

  const opening: Opening = {
    wall: sanitized.wall,
    position: sanitized.position,
    width: sanitized.width
  };

  return updateRoomInVersion(version, sanitized.roomId, (room) => {
    if (sanitized.openingKind === "door") {
      return {
        ...room,
        doors: [...room.doors, opening]
      };
    }

    return {
      ...room,
      windows: [...room.windows, opening]
    };
  });
}

function applyResizeOpening(
  version: PlanVersion,
  operation: Extract<PlanOperation, { type: "resize_opening" }>
): PlanVersion {
  const sanitized = sanitizeResizeOpeningOperation(version, operation);

  if (!sanitized) {
    return version;
  }

  return updateRoomInVersion(version, sanitized.roomId, (room) => {
    if (sanitized.openingKind === "door") {
      const doors = room.doors.map((door, index) =>
        index === sanitized.openingIndex ? { ...door, width: sanitized.width } : door
      );

      return { ...room, doors };
    }

    const windows = room.windows.map((window, index) =>
      index === sanitized.openingIndex ? { ...window, width: sanitized.width } : window
    );

    return { ...room, windows };
  });
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
    case "split_room":
      return applySplitRoom(version, operation);
    case "add_opening":
      return applyAddOpening(version, operation);
    case "resize_opening":
      return applyResizeOpening(version, operation);
    default:
      return version;
  }
}

function resolveOperationTargets(version: PlanVersion, operation: PlanOperation): string[] {
  const explicit = getOperationTargetIds(operation);

  if (explicit.length) {
    return explicit;
  }

  switch (operation.type) {
    case "move_core":
      return version.rooms.filter((room) => CORE_TYPES.has(room.type)).map((room) => room.id);
    case "widen_corridor":
      return version.rooms.filter((room) => room.type === CORRIDOR_TYPE).map((room) => room.id);
    case "align_wet_rooms":
      return version.rooms
        .filter((room) => WET_TYPES.has(room.type) || room.needsPlumbing)
        .map((room) => room.id);
    default:
      return [];
  }
}

export function getBlockedLocksForOperation(
  operation: PlanOperation,
  lockedElementIds: string[],
  version?: PlanVersion
): string[] {
  if (!lockedElementIds.length) {
    return [];
  }

  if (operation.type === "optimize_egress") {
    return [];
  }

  const locked = new Set(lockedElementIds);
  const targets = version ? resolveOperationTargets(version, operation) : getOperationTargetIds(operation);

  return targets.filter((id) => locked.has(id));
}

export function isOperationBlockedByLocks(
  operation: PlanOperation,
  lockedElementIds: string[],
  version?: PlanVersion
): boolean {
  return getBlockedLocksForOperation(operation, lockedElementIds, version).length > 0;
}

export function applyPlanOperationsWithReport(
  baseVersion: PlanVersion,
  operations: PlanOperation[],
  options: ApplyPlanOperationsOptions = {}
): PlanOperationsReport {
  const lockedElementIds = options.lockedElementIds ?? [];
  const candidate = options.acceptedOperationIds
    ? operations.filter((operation) => options.acceptedOperationIds!.includes(operation.id))
    : operations;

  const appliedOperationIds: string[] = [];
  const skippedOperations: SkippedPlanOperation[] = [];

  const reduced = candidate.reduce((version, operation) => {
    const blockedLocks = getBlockedLocksForOperation(operation, lockedElementIds, version);

    if (blockedLocks.length) {
      skippedOperations.push({
        operationId: operation.id,
        label: operation.label,
        lockedElementIds: blockedLocks
      });
      return version;
    }

    const versionBefore = version;

    if (operation.type === "add_opening" && !sanitizeAddOpeningOperation(version, operation)) {
      skippedOperations.push({
        operationId: operation.id,
        label: operation.label,
        lockedElementIds: [],
        reason: "Opening parameters could not be validated against the host wall."
      });
      return version;
    }

    if (operation.type === "resize_opening" && !sanitizeResizeOpeningOperation(version, operation)) {
      skippedOperations.push({
        operationId: operation.id,
        label: operation.label,
        lockedElementIds: [],
        reason: "Resized opening would not fit on the host wall."
      });
      return version;
    }

    const nextVersion = applyOperation(version, operation);

    if (nextVersion === versionBefore && (operation.type === "add_opening" || operation.type === "resize_opening")) {
      skippedOperations.push({
        operationId: operation.id,
        label: operation.label,
        lockedElementIds: [],
        reason: "Opening operation produced no valid geometry change."
      });
      return version;
    }

    appliedOperationIds.push(operation.id);
    return nextVersion;
  }, baseVersion);

  const version = options.skipPostProcess ? reduced : postProcessPlanVersion(reduced);

  return {
    version,
    appliedOperationIds,
    skippedOperations
  };
}

export function applyPlanOperations(
  baseVersion: PlanVersion,
  operations: PlanOperation[],
  options: ApplyPlanOperationsOptions = {}
): PlanVersion {
  return applyPlanOperationsWithReport(baseVersion, operations, options).version;
}

export function buildPreviewVersion(
  baseVersion: PlanVersion,
  proposal: PlanChangeProposal,
  options?: {
    acceptedOperationIds?: string[];
    lockedElementIds?: string[];
    versionLabel?: string;
  }
): PlanVersion {
  const report = applyPlanOperationsWithReport(baseVersion, proposal.operations, {
    acceptedOperationIds: options?.acceptedOperationIds,
    lockedElementIds: options?.lockedElementIds
  });

  return {
    ...report.version,
    id: `${baseVersion.id}-proposal-${Date.now()}`,
    label: options?.versionLabel ?? `${baseVersion.label} / Copilot Proposal`,
    createdAt: new Date().toISOString(),
    parentVersionId: baseVersion.id,
    metadata: {
      ...report.version.metadata,
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
    case "split_room":
      return `Split ${operation.roomId} ${operation.splitAxis} at ${Math.round(operation.splitRatio * 100)}%`;
    case "add_opening":
      return `Add ${operation.openingKind} on ${operation.wall} wall (${operation.width}m)`;
    case "resize_opening":
      return `Resize ${operation.openingKind} #${operation.openingIndex} to ${operation.width}m`;
  }
}
