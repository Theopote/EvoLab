import type { Point, Room } from "@/lib/project-types";

export interface CorridorWidthResult {
  roomId: string;
  roomName: string;
  clearWidthM: number;
  method: "chord-sampling" | "bbox-fallback";
}

function horizontalChordWidthAtY(polygon: Point[], y: number): number {
  const intersections: number[] = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[(index + 1) % polygon.length];

    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      const t = (y - y1) / (y2 - y1);
      intersections.push(x1 + t * (x2 - x1));
    }
  }

  intersections.sort((left, right) => left - right);

  let maxGap = 0;
  for (let index = 0; index < intersections.length - 1; index += 2) {
    maxGap = Math.max(maxGap, intersections[index + 1] - intersections[index]);
  }

  return maxGap;
}

function verticalChordWidthAtX(polygon: Point[], x: number): number {
  const intersections: number[] = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[(index + 1) % polygon.length];

    if ((x1 <= x && x2 > x) || (x2 <= x && x1 > x)) {
      const t = (x - x1) / (x2 - x1);
      intersections.push(y1 + t * (y2 - y1));
    }
  }

  intersections.sort((left, right) => left - right);

  let maxGap = 0;
  for (let index = 0; index < intersections.length - 1; index += 2) {
    maxGap = Math.max(maxGap, intersections[index + 1] - intersections[index]);
  }

  return maxGap;
}

function bboxMinWidth(polygon: Point[]) {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

export function measurePolygonClearWidth(polygon: Point[], sampleCount = 16): number {
  if (polygon.length < 3) {
    return 0;
  }

  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  if (spanX <= 0 || spanY <= 0) {
    return 0;
  }

  let minClear = Infinity;

  for (let index = 1; index < sampleCount; index += 1) {
    const x = minX + (spanX * index) / sampleCount;
    const y = minY + (spanY * index) / sampleCount;
    const verticalWidth = verticalChordWidthAtX(polygon, x);
    const horizontalWidth = horizontalChordWidthAtY(polygon, y);

    if (verticalWidth > 0.1) {
      minClear = Math.min(minClear, verticalWidth);
    }
    if (horizontalWidth > 0.1) {
      minClear = Math.min(minClear, horizontalWidth);
    }
  }

  return Number.isFinite(minClear) ? minClear : bboxMinWidth(polygon);
}

export function measureCorridorClearWidth(room: Room): CorridorWidthResult {
  const chordWidth = measurePolygonClearWidth(room.polygon);
  const bboxWidth = bboxMinWidth(room.polygon);
  const usedChord = chordWidth > 0.1 && chordWidth <= bboxWidth + 0.01;

  return {
    roomId: room.id,
    roomName: room.name,
    clearWidthM: usedChord ? chordWidth : bboxWidth,
    method: usedChord ? "chord-sampling" : "bbox-fallback"
  };
}

export function measureCorridorsClearWidth(rooms: Room[]): CorridorWidthResult[] {
  return rooms.filter((room) => room.type === "corridor").map((room) => measureCorridorClearWidth(room));
}
