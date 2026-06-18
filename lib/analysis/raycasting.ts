import type { Point, Wall } from "@/lib/project-types";

export interface Segment {
  start: Point;
  end: Point;
}

export function wallSegments(walls: Wall[], includeExternal = true): Segment[] {
  return walls
    .filter((wall) => includeExternal || wall.type !== "external")
    .map((wall) => ({ start: wall.start, end: wall.end }));
}

export function polygonSegments(polygon: Point[]): Segment[] {
  return polygon.map((start, index) => ({
    start,
    end: polygon[(index + 1) % polygon.length]
  }));
}

function cross(a: Point, b: Point, c: Point) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: Point, b: Point, point: Point) {
  return (
    Math.min(a[0], b[0]) - 0.001 <= point[0] &&
    point[0] <= Math.max(a[0], b[0]) + 0.001 &&
    Math.min(a[1], b[1]) - 0.001 <= point[1] &&
    point[1] <= Math.max(a[1], b[1]) + 0.001
  );
}

function segmentIntersection(a: Segment, b: Segment): Point | undefined {
  const d1 = cross(a.start, a.end, b.start);
  const d2 = cross(a.start, a.end, b.end);
  const d3 = cross(b.start, b.end, a.start);
  const d4 = cross(b.start, b.end, a.end);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    const x1 = a.start[0];
    const y1 = a.start[1];
    const x2 = a.end[0];
    const y2 = a.end[1];
    const x3 = b.start[0];
    const y3 = b.start[1];
    const x4 = b.end[0];
    const y4 = b.end[1];
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

    if (Math.abs(denominator) < 1e-8) {
      return undefined;
    }

    const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator;
    const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator;
    return [px, py];
  }

  if (Math.abs(d1) < 0.001 && onSegment(a.start, a.end, b.start)) {
    return b.start;
  }

  if (Math.abs(d2) < 0.001 && onSegment(a.start, a.end, b.end)) {
    return b.end;
  }

  if (Math.abs(d3) < 0.001 && onSegment(b.start, b.end, a.start)) {
    return a.start;
  }

  if (Math.abs(d4) < 0.001 && onSegment(b.start, b.end, a.end)) {
    return a.end;
  }

  return undefined;
}

export function castRay(origin: Point, direction: Point, maxDistance: number, obstacles: Segment[]): Point {
  const length = Math.hypot(direction[0], direction[1]) || 1;
  const unit = [direction[0] / length, direction[1] / length] as Point;
  const ray: Segment = {
    start: origin,
    end: [origin[0] + unit[0] * maxDistance, origin[1] + unit[1] * maxDistance]
  };

  let nearest = ray.end;
  let nearestDistance = maxDistance;

  obstacles.forEach((obstacle) => {
    const hit = segmentIntersection(ray, obstacle);

    if (!hit) {
      return;
    }

    const distance = Math.hypot(hit[0] - origin[0], hit[1] - origin[1]);

    if (distance > 0.05 && distance < nearestDistance) {
      nearestDistance = distance;
      nearest = hit;
    }
  });

  return nearest;
}

export function castRayFan(
  origin: Point,
  startAngle: number,
  endAngle: number,
  samples: number,
  maxDistance: number,
  obstacles: Segment[]
) {
  const hits: Point[] = [origin];

  for (let index = 0; index <= samples; index += 1) {
    const angle = startAngle + ((endAngle - startAngle) * index) / samples;
    hits.push(castRay(origin, [Math.cos(angle), Math.sin(angle)], maxDistance, obstacles));
  }

  return hits;
}
