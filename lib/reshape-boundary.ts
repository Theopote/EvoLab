import { pointsNear, spanVertexIndices, type BoundarySpanSelection } from "@/lib/boundary-span-select";
import { simplifyPolygon } from "@/lib/geometry-kernel";
import { remapOpeningByWallEdge } from "@/lib/opening-edge-utils";
import { polygonArea } from "@/lib/plan-validation";
import type { OpeningElement, Point, Room, Wall } from "@/lib/project-types";
import { edgeKey, polygonEdges } from "@/lib/wall-extractor";
import type { WallGraph } from "@/lib/wall-graph";

export function verifyAnchorsLocked(result: Point[], span: BoundarySpanSelection): Point[] {
  if (!result.length) {
    return [span.anchorBefore, span.anchorAfter];
  }

  const fixed = result.map(([x, y]) => [x, y] as Point);
  fixed[0] = span.anchorBefore;
  fixed[fixed.length - 1] = span.anchorAfter;
  return fixed;
}

export function applyBoundaryReshape(
  room: Room,
  span: BoundarySpanSelection,
  newMiddlePoints: Point[]
): Room {
  const curve = verifyAnchorsLocked(newMiddlePoints, span);
  const indices = new Set(
    spanVertexIndices(room.polygon.length, span.startVertexIndex, span.endVertexIndex, span.useLongArc)
  );
  const nextPolygon: Point[] = [];
  let replaced = false;

  for (let index = 0; index < room.polygon.length; index += 1) {
    if (!indices.has(index)) {
      nextPolygon.push(room.polygon[index]);
    } else if (!replaced) {
      nextPolygon.push(...curve);
      replaced = true;
    }
  }

  const simplified = simplifyPolygon(nextPolygon, 0.03);

  return {
    ...room,
    polygon: simplified,
    areaSqm: Number(polygonArea(simplified).toFixed(1))
  };
}

export function spanIncludesSharedEdge(span: BoundarySpanSelection, polygon: Point[], graph: WallGraph) {
  const indices = spanVertexIndices(polygon.length, span.startVertexIndex, span.endVertexIndex, span.useLongArc);
  const edges = polygonEdges(polygon);

  return indices.some((vertexIndex) => {
    const edge = edges[vertexIndex];
    if (!edge) {
      return false;
    }

    const graphEdge = graph.edges.find((item) => item.key === edge.key);
    return Boolean(graphEdge && graphEdge.roomIds.length > 1);
  });
}

export function openingsOnBoundarySpan(
  roomId: string,
  span: BoundarySpanSelection,
  room: Room,
  walls: Wall[],
  openings: OpeningElement[]
) {
  const indices = spanVertexIndices(room.polygon.length, span.startVertexIndex, span.endVertexIndex, span.useLongArc);
  const spanEdgeKeys = new Set(indices.map((vertexIndex) => polygonEdges(room.polygon)[vertexIndex]?.key).filter(Boolean));

  return openings.filter((opening) => {
    if (!(opening.roomIds ?? []).includes(roomId)) {
      return false;
    }

    const wall = walls.find((item) => item.id === opening.wallId);
    if (!wall) {
      return false;
    }

    return spanEdgeKeys.has(edgeKey(wall.start, wall.end));
  });
}

export function applyOpeningPolicyOnReshape(
  versionOpenings: OpeningElement[],
  affectedOpeningIds: string[],
  policy: "preserve" | "remove",
  previousWalls: Wall[],
  nextWalls: Wall[]
) {
  const affected = new Set(affectedOpeningIds);
  const repairs: string[] = [];

  const nextOpenings = versionOpenings.flatMap((opening) => {
    if (!affected.has(opening.id)) {
      return [opening];
    }

    if (policy === "remove") {
      repairs.push(`Removed opening ${opening.id} affected by boundary reshape.`);
      return [];
    }

    const remapped = remapOpeningByWallEdge(opening, previousWalls, nextWalls);

    if (!remapped) {
      repairs.push(`Removed opening ${opening.id} because its host wall no longer exists.`);
      return [];
    }

    repairs.push(`Repositioned opening ${opening.id} along reshaped wall.`);
    return [remapped];
  });

  return { openings: nextOpenings, repairs };
}

export function mockArcPoints(span: BoundarySpanSelection, segments = 12): Point[] {
  const start = span.anchorBefore;
  const end = span.anchorAfter;
  const peak = span.currentPoints.reduce(
    (best, point) => {
      const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const distance = Math.hypot(point[0] - midpoint[0], point[1] - midpoint[1]);
      return distance > best.distance ? { point, distance } : best;
    },
    { point: span.currentPoints[0] ?? start, distance: 0 }
  ).point;
  const control: Point = [
    peak[0] + (peak[0] - (start[0] + end[0]) / 2) * 0.35,
    peak[1] + (peak[1] - (start[1] + end[1]) / 2) * 0.35
  ];
  const points: Point[] = [];

  for (let step = 0; step <= segments; step += 1) {
    const t = step / segments;
    const u = 1 - t;
    points.push([
      u * u * start[0] + 2 * u * t * control[0] + t * t * end[0],
      u * u * start[1] + 2 * u * t * control[1] + t * t * end[1]
    ]);
  }

  return verifyAnchorsLocked(points, span);
}

export function syncSharedVerticesOnReshape(
  rooms: Room[],
  roomId: string,
  previousPolygon: Point[],
  nextPolygon: Point[]
): Room[] {
  const sharedPositions = new Map<string, Point>();

  previousPolygon.forEach((point, index) => {
    const nextPoint = nextPolygon[index];
    if (!nextPoint || pointsNear(point, nextPoint, 0.02)) {
      return;
    }

    sharedPositions.set(`${point[0].toFixed(3)},${point[1].toFixed(3)}`, nextPoint);
  });

  if (!sharedPositions.size) {
    return rooms;
  }

  return rooms.map((room) => {
    if (room.id === roomId) {
      return { ...room, polygon: nextPolygon };
    }

    let changed = false;
    const polygon = room.polygon.map((point) => {
      const key = `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
      const replacement = sharedPositions.get(key);

      if (!replacement) {
        return point;
      }

      changed = true;
      return replacement;
    });

    if (!changed) {
      return room;
    }

    return {
      ...room,
      polygon,
      areaSqm: Number(polygonArea(polygon).toFixed(1))
    };
  });
}
