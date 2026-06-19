import { unitePolygons } from "@/lib/geometry-kernel";
import { polygonArea } from "@/lib/plan-validation";
import type { Point, Room } from "@/lib/project-types";
import { deriveWallGraph } from "@/lib/wall-graph";

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

export function canSplitRectRoom(room: Room) {
  const bounds = roomBounds(room.polygon);
  return bounds.maxX - bounds.minX >= 2 && bounds.maxY - bounds.minY >= 2;
}

export function splitRectRoom(
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

export function roomsShareInteriorWall(roomA: Room, roomB: Room) {
  const graph = deriveWallGraph([roomA, roomB]);

  return graph.edges.some(
    (edge) => edge.roomIds.includes(roomA.id) && edge.roomIds.includes(roomB.id)
  );
}

export function findMergeableNeighborIds(roomId: string, rooms: Room[]) {
  const room = rooms.find((item) => item.id === roomId);

  if (!room) {
    return [];
  }

  return rooms
    .filter((candidate) => candidate.id !== roomId && roomsShareInteriorWall(room, candidate))
    .map((candidate) => candidate.id);
}

export function mergeAdjacentRooms(
  roomA: Room,
  roomB: Room,
  merged: { id: string; name: string }
): Room | undefined {
  if (!roomsShareInteriorWall(roomA, roomB)) {
    return undefined;
  }

  const polygons = unitePolygons(roomA.polygon, roomB.polygon);

  if (!polygons.length) {
    return undefined;
  }

  const polygon = polygons.reduce((best, candidate) =>
    polygonArea(candidate) > polygonArea(best) ? candidate : best
  );

  const adjacents = new Set([...(roomA.adjacents ?? []), ...(roomB.adjacents ?? [])]);
  adjacents.delete(roomA.id);
  adjacents.delete(roomB.id);

  return {
    ...roomA,
    id: merged.id,
    name: merged.name,
    polygon,
    areaSqm: Number(polygonArea(polygon).toFixed(1)),
    doors: [...roomA.doors, ...roomB.doors],
    windows: [...roomA.windows, ...roomB.windows],
    adjacents: [...adjacents]
  };
}
