import { clusterPoint, pointsNear, quantizePointCoords } from "@/lib/geometry/cluster-endpoints";
import type { Point } from "@/lib/project-types";
import { polygonArea } from "@/lib/plan-validation";

export interface Segment {
  start: Point;
  end: Point;
}

export interface GapCandidate {
  start: Point;
  end: Point;
  gapM: number;
  wallDirection: Point;
}

export interface ProcessedLoop {
  polygon: Point[];
  areaSqm: number;
  sourceStrokeIndex?: number;
}

const MIN_LOOP_AREA_SQM = 1.5;
const MIN_STROKE_POINTS = 3;

function perpendicularDistance(point: Point, start: Point, end: Point) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);

  if (length < Number.EPSILON) {
    return Math.hypot(point[0] - start[0], point[1] - start[1]);
  }

  return Math.abs(dy * point[0] - dx * point[1] + end[0] * start[1] - end[1] * start[0]) / length;
}

export function simplifyStroke(points: Point[], epsilon = 0.02): Point[] {
  if (points.length < 3) {
    return points.map((point) => [...point] as Point);
  }

  let maxDistance = 0;
  let index = 0;

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);

    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }

  if (maxDistance > epsilon) {
    const left = simplifyStroke(points.slice(0, index + 1), epsilon);
    const right = simplifyStroke(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[points.length - 1]];
}

function normalizeAngleDegrees(angle: number) {
  let normalized = angle % 360;

  if (normalized < 0) {
    normalized += 360;
  }

  return normalized;
}

function snapAngleDegrees(angle: number, toleranceDeg: number) {
  const targets = [0, 90, 180, 270, 360];

  for (const target of targets) {
    if (Math.abs(angle - target) <= toleranceDeg) {
      return target % 360;
    }
  }

  return angle;
}

export function regularizeAngles(segments: Segment[], toleranceDeg = 8): Segment[] {
  return segments.map((segment) => {
    const dx = segment.end[0] - segment.start[0];
    const dy = segment.end[1] - segment.start[1];
    const length = Math.hypot(dx, dy);

    if (length < Number.EPSILON) {
      return segment;
    }

    const angle = normalizeAngleDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
    const snapped = snapAngleDegrees(angle, toleranceDeg);

    if (snapped === angle) {
      return segment;
    }

    const radians = (snapped * Math.PI) / 180;

    return {
      start: segment.start,
      end: [segment.start[0] + Math.cos(radians) * length, segment.start[1] + Math.sin(radians) * length] as Point
    };
  });
}

export function strokeToSegments(points: Point[]): Segment[] {
  const segments: Segment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    segments.push({
      start: points[index],
      end: points[index + 1]
    });
  }

  return segments;
}

export function clusterSegmentEndpoints(segments: Segment[], tolerance = 0.15): Segment[] {
  const clusters = new Map<string, Point>();

  return segments.map((segment) => ({
    start: clusterPoint(segment.start, clusters, tolerance),
    end: clusterPoint(segment.end, clusters, tolerance)
  }));
}

function segmentKey(a: Point, b: Point) {
  const left = quantizePointCoords(a, 0.001);
  const right = quantizePointCoords(b, 0.001);
  const leftKey = `${left[0]},${left[1]}`;
  const rightKey = `${right[0]},${right[1]}`;
  return leftKey < rightKey ? `${leftKey}|${rightKey}` : `${rightKey}|${leftKey}`;
}

function pointKey(point: Point) {
  const [x, y] = quantizePointCoords(point, 0.001);
  return `${x},${y}`;
}

export function isClosedStroke(points: Point[], tolerance = 0.25) {
  if (points.length < MIN_STROKE_POINTS) {
    return false;
  }

  return pointsNear(points[0], points[points.length - 1], tolerance);
}

export function closeStrokePolygon(points: Point[]): Point[] {
  if (points.length < MIN_STROKE_POINTS) {
    return [];
  }

  const simplified = simplifyStroke(points);
  const closed =
    simplified[0][0] === simplified[simplified.length - 1][0] &&
    simplified[0][1] === simplified[simplified.length - 1][1]
      ? simplified.slice(0, -1)
      : isClosedStroke(simplified)
        ? simplified.slice(0, -1)
        : simplified;

  if (closed.length < 3) {
    return [];
  }

  const segments = clusterSegmentEndpoints(regularizeAngles(strokeToSegments([...closed, closed[0]])));
  const polygon = segments.map((segment) => segment.start);
  const area = polygonArea(polygon);

  if (area < MIN_LOOP_AREA_SQM) {
    return [];
  }

  return polygon;
}

export function detectClosedLoops(segments: Segment[]): Point[][] {
  const adjacency = new Map<string, string[]>();

  segments.forEach((segment) => {
    const startKey = pointKey(segment.start);
    const endKey = pointKey(segment.end);

    if (startKey === endKey) {
      return;
    }

    adjacency.set(startKey, [...(adjacency.get(startKey) ?? []), endKey]);
    adjacency.set(endKey, [...(adjacency.get(endKey) ?? []), startKey]);
  });

  const loops: Point[][] = [];
  const visitedEdges = new Set<string>();

  function walk(startKey: string, currentKey: string, path: string[]): void {
    const neighbors = adjacency.get(currentKey) ?? [];

    for (const nextKey of neighbors) {
      const edge = segmentKey(
        nextKey.split(",").map(Number) as Point,
        currentKey.split(",").map(Number) as Point
      );

      if (visitedEdges.has(edge)) {
        continue;
      }

      if (nextKey === startKey && path.length >= 3) {
        const polygon = path.map((key) => {
          const [x, y] = key.split(",").map(Number);
          return [x, y] as Point;
        });

        if (polygonArea(polygon) >= MIN_LOOP_AREA_SQM) {
          loops.push(polygon);
        }

        continue;
      }

      if (path.includes(nextKey)) {
        continue;
      }

      visitedEdges.add(edge);
      walk(startKey, nextKey, [...path, nextKey]);
      visitedEdges.delete(edge);
    }
  }

  for (const startKey of adjacency.keys()) {
    walk(startKey, startKey, [startKey]);
  }

  return dedupePolygons(loops);
}

function dedupePolygons(polygons: Point[][]) {
  const seen = new Set<string>();

  return polygons.filter((polygon) => {
    const key = [...polygon]
      .map(pointKey)
      .sort()
      .join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function detectWallGaps(segments: Segment[], maxGapM = 1.2, minGapM = 0.5): GapCandidate[] {
  const gaps: GapCandidate[] = [];

  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const left = segments[leftIndex];
      const right = segments[rightIndex];
      const pairs: Array<[Point, Point]> = [
        [left.end, right.start],
        [left.start, right.end],
        [left.end, right.end],
        [left.start, right.start]
      ];

      pairs.forEach(([a, b]) => {
        const gapM = Math.hypot(a[0] - b[0], a[1] - b[1]);

        if (gapM < minGapM || gapM > maxGapM) {
          return;
        }

        const direction: Point = [left.end[0] - left.start[0], left.end[1] - left.start[1]];
        const length = Math.hypot(direction[0], direction[1]);

        if (length < Number.EPSILON) {
          return;
        }

        gaps.push({
          start: a,
          end: b,
          gapM,
          wallDirection: [direction[0] / length, direction[1] / length]
        });
      });
    }
  }

  return gaps;
}

export function processSketchStrokes(strokes: Point[][]): ProcessedLoop[] {
  const allSegments: Segment[] = [];

  strokes.forEach((stroke, strokeIndex) => {
    const polygon = closeStrokePolygon(stroke);

    if (polygon.length >= 3) {
      allSegments.push(...strokeToSegments([...polygon, polygon[0]]));
      return;
    }

    const simplified = simplifyStroke(stroke);
    allSegments.push(...strokeToSegments(simplified));
  });

  const cleaned = clusterSegmentEndpoints(regularizeAngles(allSegments));
  const loops = detectClosedLoops(cleaned);

  return loops.map((polygon, index) => ({
    polygon,
    areaSqm: polygonArea(polygon),
    sourceStrokeIndex: index
  }));
}

export function processStrokeGhost(stroke: Point[]): Point[] {
  return closeStrokePolygon(stroke);
}
