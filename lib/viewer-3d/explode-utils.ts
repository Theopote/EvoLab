import type { Point } from "@/lib/project-types";
import { getPolygonBounds } from "@/components/viewer-3d/wallGeometry";

export function getBuildingCenter(outline: Point[]): Point {
  const bounds = getPolygonBounds(outline);
  return [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
}

export function getRoomExplodeOffset(
  roomPolygon: Point[],
  buildingOutline: Point[],
  explodeFactor: number,
  spread = 0.38
): Point {
  if (explodeFactor <= 0) {
    return [0, 0];
  }

  const buildingCenter = getBuildingCenter(buildingOutline);
  const roomBounds = getPolygonBounds(roomPolygon);
  const roomCenterX = (roomBounds.minX + roomBounds.maxX) / 2;
  const roomCenterY = (roomBounds.minY + roomBounds.maxY) / 2;

  return [
    (roomCenterX - buildingCenter[0]) * spread * explodeFactor,
    (roomCenterY - buildingCenter[1]) * spread * explodeFactor
  ];
}
