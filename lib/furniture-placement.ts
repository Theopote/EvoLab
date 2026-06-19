import type { FurnitureItem } from "@/lib/building-domain";
import { pointInPolygon } from "@/lib/geometry-kernel";
import { snapPoint, type GridSnapStep } from "@/lib/plan-snap";
import type { Point, Room } from "@/lib/project-types";

export function furnitureFootprintCorners(
  item: Pick<FurnitureItem, "position" | "width" | "depth" | "rotationDeg">
): Point[] {
  const halfW = item.width / 2;
  const halfD = item.depth / 2;
  const radians = (item.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const localCorners: Point[] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD]
  ];

  return localCorners.map(([x, y]) => {
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;
    return [item.position[0] + rotatedX, item.position[1] + rotatedY] as Point;
  });
}

export function furnitureFitsInRoom(
  item: Pick<FurnitureItem, "position" | "width" | "depth" | "rotationDeg">,
  roomPolygon: Point[]
) {
  return furnitureFootprintCorners(item).every((corner) => pointInPolygon(corner, roomPolygon));
}

export function constrainFurniturePosition(
  position: Point,
  item: Pick<FurnitureItem, "width" | "depth" | "rotationDeg">,
  roomPolygon: Point[],
  options?: { gridStep?: GridSnapStep }
): Point | null {
  const snapped = snapPoint(position, { gridEnabled: true, gridStep: options?.gridStep ?? 0.1 });
  const candidate = { ...item, position: snapped };

  if (furnitureFitsInRoom(candidate, roomPolygon)) {
    return snapped;
  }

  if (pointInPolygon(snapped, roomPolygon)) {
    return snapped;
  }

  return null;
}

export function roomPolygonForFurniture(roomId: string, rooms: Room[]) {
  return rooms.find((room) => room.id === roomId)?.polygon;
}
