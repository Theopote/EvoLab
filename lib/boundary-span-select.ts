import type { Point, Room } from "@/lib/project-types";
import { polygonEdges } from "@/lib/wall-extractor";

export interface BoundarySpanSelection {
  roomId: string;
  startVertexIndex: number;
  endVertexIndex: number;
  useLongArc: boolean;
  anchorBefore: Point;
  anchorAfter: Point;
  currentPoints: Point[];
}

function roundCoord(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function pointsNear(a: Point, b: Point, tolerance = 0.15) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) <= tolerance;
}

export function spanVertexIndices(
  vertexCount: number,
  startVertexIndex: number,
  endVertexIndex: number,
  useLongArc = false
): number[] {
  if (vertexCount < 3) {
    return [];
  }

  const forward: number[] = [];
  let index = startVertexIndex;

  while (true) {
    forward.push(index);
    if (index === endVertexIndex) {
      break;
    }
    index = (index + 1) % vertexCount;
    if (forward.length > vertexCount) {
      break;
    }
  }

  const backward: number[] = [];
  index = startVertexIndex;

  while (true) {
    backward.push(index);
    if (index === endVertexIndex) {
      break;
    }
    index = (index - 1 + vertexCount) % vertexCount;
    if (backward.length > vertexCount) {
      break;
    }
  }

  const chosen = useLongArc
    ? forward.length >= backward.length
      ? forward
      : backward
    : forward.length <= backward.length
      ? forward
      : backward;

  return chosen;
}

export function buildBoundarySpan(
  room: Room,
  startVertexIndex: number,
  endVertexIndex: number,
  useLongArc = false
): BoundarySpanSelection | undefined {
  const polygon = room.polygon;

  if (polygon.length < 3) {
    return undefined;
  }

  if (startVertexIndex < 0 || startVertexIndex >= polygon.length) {
    return undefined;
  }

  if (endVertexIndex < 0 || endVertexIndex >= polygon.length) {
    return undefined;
  }

  const indices = spanVertexIndices(polygon.length, startVertexIndex, endVertexIndex, useLongArc);

  if (!indices.length) {
    return undefined;
  }

  const anchorBefore = polygon[(indices[0] - 1 + polygon.length) % polygon.length];
  const anchorAfter = polygon[(indices[indices.length - 1] + 1) % polygon.length];
  const currentPoints = indices.map((vertexIndex) => polygon[vertexIndex]);

  return {
    roomId: room.id,
    startVertexIndex,
    endVertexIndex,
    useLongArc,
    anchorBefore,
    anchorAfter,
    currentPoints
  };
}

export function hitTestRoomVertex(room: Room, point: Point, tolerance = 0.45): number | undefined {
  let closestIndex: number | undefined;
  let closestDistance = tolerance;

  room.polygon.forEach((vertex, index) => {
    const distance = Math.hypot(vertex[0] - point[0], vertex[1] - point[1]);

    if (distance <= closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}

export function spanEdgeKeys(span: BoundarySpanSelection, polygon: Point[]) {
  const indices = spanVertexIndices(polygon.length, span.startVertexIndex, span.endVertexIndex, span.useLongArc);
  const edges = polygonEdges(polygon);

  return indices.map((vertexIndex) => edges[vertexIndex]?.key).filter(Boolean);
}

export function snapPointToEdge(point: Point, start: Point, end: Point): Point {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq < 0.0001) {
    return [roundCoord(start[0]), roundCoord(start[1])];
  }

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSq)
  );

  return [roundCoord(start[0] + dx * t), roundCoord(start[1] + dy * t)];
}
