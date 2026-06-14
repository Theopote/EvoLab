import type { Point, Room, Wall } from "@/lib/project-types";

interface EdgeRecord {
  key: string;
  start: Point;
  end: Point;
  roomIds: string[];
  roomTypes: Room["type"][];
  maxHeight: number;
}

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function pointKey(point: Point) {
  return `${round(point[0])},${round(point[1])}`;
}

export function edgeKey(start: Point, end: Point) {
  const a = pointKey(start);
  const b = pointKey(end);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function polygonEdges(points: Point[]) {
  return points.map((start, index) => ({
    start,
    end: points[(index + 1) % points.length],
    key: edgeKey(start, points[(index + 1) % points.length])
  }));
}

function isCoreRoomType(type: Room["type"]) {
  return type === "stair" || type === "elevator" || type === "shaft";
}

function classifyWall(edge: EdgeRecord, outlineKeys: Set<string>): Wall["type"] {
  if (edge.roomTypes.some(isCoreRoomType)) {
    return "core";
  }

  if (outlineKeys.has(edge.key)) {
    return "external";
  }

  return edge.roomIds.length > 1 ? "internal" : "partition";
}

function wallThickness(type: Wall["type"]) {
  if (type === "core") {
    return 0.32;
  }

  if (type === "external") {
    return 0.3;
  }

  return 0.18;
}

export function extractWallsFromRooms(rooms: Room[], outline: Point[]): Wall[] {
  const outlineKeys = new Set(polygonEdges(outline).map((edge) => edge.key));
  const edges = new Map<string, EdgeRecord>();

  rooms.forEach((room) => {
    polygonEdges(room.polygon).forEach((edge) => {
      const existing = edges.get(edge.key);

      if (existing) {
        existing.roomIds = Array.from(new Set([...existing.roomIds, room.id]));
        existing.roomTypes = Array.from(new Set([...existing.roomTypes, room.type]));
        existing.maxHeight = Math.max(existing.maxHeight, room.ceilingHeight);
        return;
      }

      edges.set(edge.key, {
        key: edge.key,
        start: edge.start,
        end: edge.end,
        roomIds: [room.id],
        roomTypes: [room.type],
        maxHeight: room.ceilingHeight
      });
    });
  });

  return [...edges.values()].map((edge, index) => {
    const type = classifyWall(edge, outlineKeys);

    return {
      id: `wall-${index + 1}`,
      start: edge.start,
      end: edge.end,
      thickness: wallThickness(type),
      height: Math.max(2.7, edge.maxHeight),
      type,
      roomIds: edge.roomIds
    };
  });
}
