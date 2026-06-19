import { intersectPolygons, unitePolygons } from "@/lib/geometry-kernel";
import { evaluateBayWindowGfaExempt, type BayWindowGfaThresholds } from "@/lib/gfa-exemption";
import { polygonArea } from "@/lib/plan-validation";
import type { Point, Room, RoomProtrusion, Wall } from "@/lib/project-types";
import { openingCenterFromEdgeParam } from "@/lib/opening-edge-utils";

function wallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

function outwardNormal(wall: Wall, interiorPoint?: Point): Point {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy) || 1;
  let nx = -dy / length;
  let ny = dx / length;

  if (!interiorPoint) {
    return [nx, ny];
  }

  const midpoint: Point = [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2];
  const toInterior = [interiorPoint[0] - midpoint[0], interiorPoint[1] - midpoint[1]];
  const dot = nx * toInterior[0] + ny * toInterior[1];

  if (dot > 0) {
    return [-nx, -ny];
  }

  return [nx, ny];
}

function roomCentroid(polygon: Point[]): Point {
  const sum = polygon.reduce(
    (acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point,
    [0, 0] as Point
  );

  return [sum[0] / polygon.length, sum[1] / polygon.length];
}

function extractLargestRing(rings: Point[][]) {
  if (!rings.length) {
    return undefined;
  }

  return rings.reduce((best, candidate) => (polygonArea(candidate) > polygonArea(best) ? candidate : best));
}

export function clipToSiteOutline(footprint: Point[], siteOutline: Point[]) {
  if (!siteOutline.length || footprint.length < 3) {
    return footprint;
  }

  const clipped = intersectPolygons(footprint, siteOutline);
  return extractLargestRing(clipped) ?? footprint;
}

export function buildBayWindowFootprint(
  wall: Wall,
  positionOnEdge: number,
  widthM: number,
  depthM: number,
  hostPolygon?: Point[]
): Point[] {
  const length = wallLength(wall);

  if (length < 0.5) {
    return [];
  }

  const halfWidth = Math.min(widthM / 2, length / 2 - 0.05);
  const startT = Math.max(0.05, positionOnEdge - halfWidth / length);
  const endT = Math.min(0.95, positionOnEdge + halfWidth / length);
  const baseStart: Point = [
    wall.start[0] + (wall.end[0] - wall.start[0]) * startT,
    wall.start[1] + (wall.end[1] - wall.start[1]) * startT
  ];
  const baseEnd: Point = [
    wall.start[0] + (wall.end[0] - wall.start[0]) * endT,
    wall.start[1] + (wall.end[1] - wall.start[1]) * endT
  ];
  const [nx, ny] = outwardNormal(wall, hostPolygon ? roomCentroid(hostPolygon) : undefined);
  const tipStart: Point = [baseStart[0] + nx * depthM, baseStart[1] + ny * depthM];
  const tipEnd: Point = [baseEnd[0] + nx * depthM, baseEnd[1] + ny * depthM];
  const tipCenter: Point = [
    (tipStart[0] + tipEnd[0]) / 2 + nx * depthM * 0.15,
    (tipStart[1] + tipEnd[1]) / 2 + ny * depthM * 0.15
  ];

  return [baseStart, tipStart, tipCenter, tipEnd, baseEnd];
}

export function addProtrusion(
  room: Room,
  protrusion: RoomProtrusion,
  siteOutline: Point[],
  gfaThresholds: BayWindowGfaThresholds
): Room | undefined {
  const clamped = clipToSiteOutline(protrusion.footprint, siteOutline);
  const unioned = unitePolygons(room.polygon, clamped);
  const polygon = extractLargestRing(unioned);

  if (!polygon) {
    return undefined;
  }

  const gfa = evaluateBayWindowGfaExempt(
    { ...protrusion, footprint: clamped },
    gfaThresholds
  );

  return {
    ...room,
    polygon,
    areaSqm: Number(polygonArea(polygon).toFixed(1)),
    protrusions: [
      ...(room.protrusions ?? []),
      {
        ...protrusion,
        footprint: clamped,
        gfaExempt: gfa.exempt,
        gfaExemptBasis: gfa.basis
      }
    ]
  };
}

export function createProtrusionPlacement(
  wall: Wall,
  positionOnEdge: number,
  widthM: number,
  depthM: number,
  type: RoomProtrusion["type"] = "bay_window",
  hostPolygon?: Point[]
): RoomProtrusion | undefined {
  const footprint = buildBayWindowFootprint(wall, positionOnEdge, widthM, depthM, hostPolygon);

  if (footprint.length < 3) {
    return undefined;
  }

  const center = openingCenterFromEdgeParam(wall, positionOnEdge);

  return {
    id: `protrusion-${Date.now()}`,
    type,
    footprint,
    depthM,
    sillHeightM: 0.9,
    centerOnWall: center,
    widthM,
    positionOnEdge
  };
}

export function protrusionDimensions(protrusion: RoomProtrusion) {
  const xs = protrusion.footprint.map(([x]) => x);
  const ys = protrusion.footprint.map(([, y]) => y);

  return {
    widthM: protrusion.widthM ?? Math.max(...xs) - Math.min(...xs),
    depthM: protrusion.depthM
  };
}
