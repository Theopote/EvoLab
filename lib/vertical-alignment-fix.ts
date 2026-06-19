import type { SelectionBBox } from "@/lib/region-lock";
import { bboxFromPoints } from "@/lib/region-lock";
import { getResolvedLevel } from "@/lib/level-rooms";
import {
  enrichUserRequestWithStructuralConstraints,
  lockedPositionFromElement,
  roomsNearStructuralPosition,
  type StructuralConstraintSet
} from "@/lib/structural-constraints";
import type { PlanVersion, Point, VerticalAlignmentIssue } from "@/lib/project-types";

export interface AlignmentFixPackage {
  levelId: string;
  floorName: string;
  userRequest: string;
  structuralConstraints: StructuralConstraintSet;
  allowedRoomIds: string[];
  maskBBox: SelectionBBox;
  highlightRoomIds: string[];
}

function isPointPosition(position: Point | Point[]): position is Point {
  return !Array.isArray(position[0]);
}

export function buildAlignmentFixPackage(
  version: PlanVersion,
  issue: VerticalAlignmentIssue
): AlignmentFixPackage | undefined {
  const level = version.levels.find((item) => item.id === issue.floorId);

  if (!level) {
    return undefined;
  }

  const element = version.verticalElements?.find((item) => item.id === issue.elementId);
  const resolvedLevel = getResolvedLevel(version, level.id);
  const rooms = resolvedLevel?.rooms ?? [];

  const position =
    issue.position ??
    (element && isPointPosition(element.position) ? element.position : undefined);

  if (!position) {
    return undefined;
  }

  const nearbyRooms = roomsNearStructuralPosition(rooms, position, 8);
  const allowedRoomIds = nearbyRooms.map((room) => room.id);
  const locked = lockedPositionFromElement(
    element ?? {
      id: issue.elementId,
      kind: issue.elementKind,
      position,
      appliesFromFloorId: level.id,
      appliesToFloorId: level.id,
      label: issue.elementKind
    }
  );

  if (!locked) {
    return undefined;
  }

  const roomNames = nearbyRooms.map((room) => room.name);
  const baseRequest = `Adjust the room layout on ${level.name} so the fixed structural ${issue.elementKind} at [${position[0].toFixed(
    2
  )}, ${position[1].toFixed(2)}] has a valid container space. Expand or reshape nearby rooms if needed, but do not move the structural position.`;
  const userRequest = enrichUserRequestWithStructuralConstraints(
    baseRequest,
    { lockedPositions: [locked] },
    { floorName: level.name, roomNames }
  );
  const maskBBox =
    bboxFromPoints(
      [...nearbyRooms.flatMap((room) => room.polygon), position],
      1.5
    ) ?? {
      minX: position[0] - 4,
      minY: position[1] - 4,
      maxX: position[0] + 4,
      maxY: position[1] + 4
    };

  return {
    levelId: level.id,
    floorName: level.name,
    userRequest,
    structuralConstraints: { lockedPositions: [locked] },
    allowedRoomIds,
    maskBBox,
    highlightRoomIds: allowedRoomIds
  };
}
