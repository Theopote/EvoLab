import type { Level, Point, Room, Wall } from "@/lib/project-types";
import { clientToSvgPoint } from "@/components/floor-plan/floor-plan-utils";
import { applyLevelWallDrag } from "@/lib/geometry/walls/apply-wall-drag";
import { applyWallDragByOffset } from "@/lib/wall-graph";
import { projectDeltaOntoNormal, snapPoint, wallUnitNormal, type GridSnapStep } from "@/lib/plan-snap";
import type { WallDragCommitInput } from "@/lib/store/types";

export type { WallDragCommitInput };

export interface WallDragSession {
  pointerId: number;
  dragStart: Point;
  originalRooms: Room[];
  wallId: string;
  wallNormal: Point;
}

export function wallDragOffsetFromPointer(
  event: React.PointerEvent,
  session: WallDragSession,
  svgElement: SVGSVGElement,
  gridEnabled: boolean,
  gridStep: GridSnapStep
) {
  const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);
  const rawDelta: Point = [x - session.dragStart[0], y - session.dragStart[1]];
  const projected = projectDeltaOntoNormal(rawDelta, session.wallNormal);
  const nextPoint = snapPoint([session.dragStart[0] + projected[0], session.dragStart[1] + projected[1]], {
    gridEnabled,
    gridStep
  });
  const snappedDelta: Point = [nextPoint[0] - session.dragStart[0], nextPoint[1] - session.dragStart[1]];

  return snappedDelta[0] * session.wallNormal[0] + snappedDelta[1] * session.wallNormal[1];
}

export function previewWallDrag(session: WallDragSession, offset: number) {
  return applyWallDragByOffset(session.originalRooms, session.wallId, offset, session.wallNormal);
}

export function previewLevelWallDrag(level: Level, session: WallDragSession, offset: number, levelOutline: Point[]) {
  const previewLevel = applyLevelWallDrag(level, session.wallId, offset, session.wallNormal, levelOutline);

  return {
    rooms: previewLevel.rooms,
    walls: previewLevel.walls
  };
}

export function wallDragCommitInput(session: WallDragSession, offset: number): WallDragCommitInput {
  return {
    wallId: session.wallId,
    offset,
    normal: session.wallNormal
  };
}

export function createWallDragSession(
  event: React.PointerEvent,
  wall: Wall,
  originalRooms: Room[]
): WallDragSession | null {
  const svgElement = (event.currentTarget as SVGSVGElement).ownerSVGElement ?? (event.currentTarget as SVGSVGElement);

  if (!svgElement) {
    return null;
  }

  const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);

  return {
    pointerId: event.pointerId,
    dragStart: [x, y],
    originalRooms,
    wallId: wall.id,
    wallNormal: wallUnitNormal(wall)
  };
}

export function isWallDragAllowed(wall: Wall, lockedElementIds: string[]) {
  return !wall.roomIds.some((roomId) => lockedElementIds.includes(roomId));
}
