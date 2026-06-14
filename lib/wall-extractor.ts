import type { Point, Room, Wall } from "@/lib/project-types";

interface EdgeRecord {
  key: string;
  start: Point;
  end: Point;
  roomIds: string[];
  roomTypes: Room["type"][];
  maxHeight: number;
}

interface OutlineEdge {
  start: Point;
  end: Point;
  key: string;
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

function pointOnSegment(point: Point, start: Point, end: Point) {
  const cross = (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > 0.001) {
    return false;
  }

  const dot = (point[0] - start[0]) * (end[0] - start[0]) + (point[1] - start[1]) * (end[1] - start[1]);
  if (dot < -0.001) {
    return false;
  }

  const squaredLength = (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2;
  return dot <= squaredLength + 0.001;
}

function isCoreRoomType(type: Room["type"]) {
  return type === "stair" || type === "elevator" || type === "shaft";
}

function isOnOutline(edge: EdgeRecord, outlineEdges: OutlineEdge[]) {
  return outlineEdges.some(
    (outlineEdge) =>
      outlineEdge.key === edge.key ||
      (pointOnSegment(edge.start, outlineEdge.start, outlineEdge.end) &&
        pointOnSegment(edge.end, outlineEdge.start, outlineEdge.end))
  );
}

function classifyWall(edge: EdgeRecord, outlineEdges: OutlineEdge[]): Wall["type"] {
  if (edge.roomTypes.some(isCoreRoomType)) {
    return "core";
  }

  if (isOnOutline(edge, outlineEdges)) {
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
  const outlineEdges = polygonEdges(outline);
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
    const type = classifyWall(edge, outlineEdges);

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
