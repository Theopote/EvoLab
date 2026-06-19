import { pointInPolygon } from "@/lib/geometry-kernel";
import { resolveLevelRooms } from "@/lib/level-rooms";
import { isPolygonInside } from "@/lib/polygon-ops";
import type {
  PlanVersion,
  Point,
  Room,
  VerticalElement,
  VerticalElementKind
} from "@/lib/project-types";

export interface LockedStructuralPosition {
  id: string;
  kind: VerticalElementKind;
  position: Point;
  label?: string;
}

export interface StructuralConstraintSet {
  lockedPositions: LockedStructuralPosition[];
  toleranceM?: number;
}

const COLUMN_CONTAINER_TYPES = new Set<Room["type"]>([
  "corridor",
  "stair",
  "elevator",
  "shaft",
  "equipment_room",
  "lobby"
]);

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function roomCentroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function isPointPosition(position: Point | Point[]): position is Point {
  return !Array.isArray(position[0]);
}

export function lockedPositionFromElement(element: VerticalElement): LockedStructuralPosition | undefined {
  if (!isPointPosition(element.position)) {
    return undefined;
  }

  return {
    id: element.id,
    kind: element.kind,
    position: element.position,
    label: element.label
  };
}

export function buildStructuralConstraintPrompt(
  constraints: StructuralConstraintSet,
  context?: { floorName?: string; roomNames?: string[] }
) {
  if (!constraints.lockedPositions.length) {
    return "";
  }

  const targetRooms =
    context?.roomNames?.length ? `Target rooms: ${context.roomNames.join(", ")}.` : "Adjust only nearby rooms.";
  const floorLabel = context?.floorName ? ` on ${context.floorName}` : "";
  const locks = constraints.lockedPositions
    .map(
      (lock) =>
        `- ${lock.label ?? lock.kind} must stay at [${lock.position[0].toFixed(2)}, ${lock.position[1].toFixed(2)}]`
    )
    .join("\n");

  return `Structural constraints${floorLabel} (fixed positions — do not move):
${locks}
${targetRooms}
Ensure each fixed structure sits inside a valid container room (corridor, stair, elevator, shaft, equipment, or lobby) and is not blocked by a door opening.`;
}

export function enrichUserRequestWithStructuralConstraints(
  userRequest: string,
  constraints?: StructuralConstraintSet,
  context?: { floorName?: string; roomNames?: string[] }
) {
  const structuralPrompt = constraints ? buildStructuralConstraintPrompt(constraints, context) : "";

  if (!structuralPrompt) {
    return userRequest.trim();
  }

  return `${userRequest.trim()}\n\n${structuralPrompt}`;
}

export function roomsNearStructuralPosition(rooms: Room[], position: Point, radiusM = 6) {
  return rooms.filter((room) => {
    if (pointInPolygon(position, room.polygon)) {
      return true;
    }

    return distance(roomCentroid(room), position) <= radiusM;
  });
}

function roomsAllowingPoint(kind: VerticalElementKind, rooms: Room[]) {
  if (kind === "column") {
    const filtered = rooms.filter((room) => COLUMN_CONTAINER_TYPES.has(room.type));
    return filtered.length ? filtered : rooms;
  }

  if (kind === "mep_shaft") {
    const filtered = rooms.filter(
      (room) => room.type === "shaft" || room.type === "equipment_room" || room.type === "corridor"
    );
    return filtered.length ? filtered : rooms;
  }

  return rooms;
}

export function validateStructuralConstraints(
  version: PlanVersion,
  levelId: string,
  constraints: StructuralConstraintSet
) {
  const level = version.levels.find((item) => item.id === levelId);

  if (!level) {
    return ["Active level was not found."];
  }

  const rooms = resolveLevelRooms(level, version.standardFloorGroups);
  const violations: string[] = [];

  constraints.lockedPositions.forEach((lock) => {
    const allowed = roomsAllowingPoint(lock.kind, rooms);
    const contained = allowed.some((room) => pointInPolygon(lock.position, room.polygon));

    if (!contained) {
      violations.push(
        `${lock.label ?? lock.kind} at [${lock.position[0].toFixed(2)}, ${lock.position[1].toFixed(
          2
        )}] has no valid container room on ${level.name}.`
      );
    }
  });

  return violations;
}

export function validatePolygonConstraint(
  rooms: Room[],
  polygon: Point[],
  allowedTypes: Set<Room["type"]>
) {
  const allowed = rooms.filter((room) => allowedTypes.has(room.type));
  return (allowed.length ? allowed : rooms).some((room) => isPolygonInside(polygon, room.polygon, 0.05));
}
