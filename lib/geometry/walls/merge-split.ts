import { remapOpenings } from "@/lib/architecture-model";
import { normalizeOpeningElements, wallEdgeIdFromWall } from "@/lib/opening-edge-utils";
import { openingCenterFromPosition } from "@/lib/opening-wall-utils";
import { pointsNear } from "@/lib/wall-graph";
import type { OpeningElement, Point, Wall } from "@/lib/project-types";

const PARAM_EPSILON = 0.001;

function clonePoint(point: Point): Point {
  return [...point] as Point;
}

function unitVector(start: Point, end: Point): Point {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.hypot(dx, dy);

  if (length < 0.001) {
    return [0, 0];
  }

  return [dx / length, dy / length];
}

function areCollinear(wallA: Wall, wallB: Wall, tolerance = 0.02) {
  const vectorA = unitVector(wallA.start, wallA.end);
  const vectorB = unitVector(wallB.start, wallB.end);
  const cross = Math.abs(vectorA[0] * vectorB[1] - vectorA[1] * vectorB[0]);

  return cross < tolerance;
}

function sharedEndpoint(wallA: Wall, wallB: Wall) {
  if (pointsNear(wallA.start, wallB.start)) {
    return { point: clonePoint(wallA.start), wallAEnd: "start" as const, wallBEnd: "start" as const };
  }

  if (pointsNear(wallA.start, wallB.end)) {
    return { point: clonePoint(wallA.start), wallAEnd: "start" as const, wallBEnd: "end" as const };
  }

  if (pointsNear(wallA.end, wallB.start)) {
    return { point: clonePoint(wallA.end), wallAEnd: "end" as const, wallBEnd: "start" as const };
  }

  if (pointsNear(wallA.end, wallB.end)) {
    return { point: clonePoint(wallA.end), wallAEnd: "end" as const, wallBEnd: "end" as const };
  }

  return undefined;
}

function farEndpoint(wall: Wall, nearEnd: "start" | "end"): Point {
  return nearEnd === "start" ? clonePoint(wall.end) : clonePoint(wall.start);
}

function wallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

function mergedWallGeometry(wallA: Wall, wallB: Wall, keepWallId: string): Wall | undefined {
  const joint = sharedEndpoint(wallA, wallB);

  if (!joint || !areCollinear(wallA, wallB)) {
    return undefined;
  }

  const start = farEndpoint(wallA, joint.wallAEnd);
  const end = farEndpoint(wallB, joint.wallBEnd);

  return {
    ...wallA,
    id: keepWallId,
    start,
    end,
    roomIds: Array.from(new Set([...wallA.roomIds, ...wallB.roomIds])),
    thickness: Math.max(wallA.thickness, wallB.thickness),
    height: Math.max(wallA.height, wallB.height)
  };
}

export function canMergeWalls(walls: Wall[], wallIdA: string, wallIdB: string) {
  const wallA = walls.find((wall) => wall.id === wallIdA);
  const wallB = walls.find((wall) => wall.id === wallIdB);

  if (!wallA || !wallB || wallIdA === wallIdB) {
    return false;
  }

  return Boolean(mergedWallGeometry(wallA, wallB, wallIdA));
}

export function mergeWalls(
  walls: Wall[],
  wallIdA: string,
  wallIdB: string,
  openings: OpeningElement[] = []
): { walls: Wall[]; openings: OpeningElement[] } | undefined {
  const wallA = walls.find((wall) => wall.id === wallIdA);
  const wallB = walls.find((wall) => wall.id === wallIdB);

  if (!wallA || !wallB) {
    return undefined;
  }

  const merged = mergedWallGeometry(wallA, wallB, wallIdA);

  if (!merged) {
    return undefined;
  }

  const nextWalls = walls
    .filter((wall) => wall.id !== wallIdB)
    .map((wall) => (wall.id === wallIdA ? merged : wall));

  const lengthA = wallLength(wallA);
  const lengthB = wallLength(wallB);
  const totalLength = lengthA + lengthB;

  const nextOpenings = openings.flatMap((opening) => {
    if (opening.wallId === wallIdB) {
      const positionOnEdge =
        totalLength > 0.001
          ? ((opening.positionOnEdge ?? 0.5) * lengthB + lengthA) / totalLength
          : 0.5;

      return [
        normalizeOpeningOnWall(
          {
            ...opening,
            wallId: wallIdA,
            positionOnEdge
          },
          merged
        )
      ];
    }

    if (opening.wallId === wallIdA) {
      const positionOnEdge =
        totalLength > 0.001 ? ((opening.positionOnEdge ?? 0.5) * lengthA) / totalLength : opening.positionOnEdge;

      return [
        normalizeOpeningOnWall(
          {
            ...opening,
            positionOnEdge
          },
          merged
        )
      ];
    }

    return [opening];
  });

  return {
    walls: nextWalls,
    openings: normalizeOpeningElements(nextOpenings, nextWalls)
  };
}

function normalizeOpeningOnWall(opening: OpeningElement, wall: Wall): OpeningElement {
  const positionOnEdge = opening.positionOnEdge ?? 0.5;

  return {
    ...opening,
    wallId: wall.id,
    wallEdgeId: wallEdgeIdFromWall(wall),
    positionOnEdge,
    center: openingCenterFromPosition(wall, positionOnEdge)
  };
}

export function splitWallAtParam(
  walls: Wall[],
  wallId: string,
  param: number,
  secondWallId = `${wallId}-b`,
  openings: OpeningElement[] = []
): { walls: Wall[]; openings: OpeningElement[]; splitPoint: Point } | undefined {
  if (param <= PARAM_EPSILON || param >= 1 - PARAM_EPSILON) {
    return undefined;
  }

  const wall = walls.find((candidate) => candidate.id === wallId);

  if (!wall) {
    return undefined;
  }

  const splitPoint: Point = [
    wall.start[0] + (wall.end[0] - wall.start[0]) * param,
    wall.start[1] + (wall.end[1] - wall.start[1]) * param
  ];
  const firstWall: Wall = {
    ...wall,
    end: splitPoint
  };
  const secondWall: Wall = {
    ...wall,
    id: secondWallId,
    start: splitPoint
  };

  const nextWalls = walls.flatMap((candidate) =>
    candidate.id === wallId ? [firstWall, secondWall] : [candidate]
  );

  const nextOpenings = openings.flatMap((opening) => {
    if (opening.wallId !== wallId) {
      return [opening];
    }

    const position = opening.positionOnEdge ?? 0.5;

    if (position < param - PARAM_EPSILON) {
      return [
        normalizeOpeningOnWall(
          {
            ...opening,
            positionOnEdge: position / param
          },
          firstWall
        )
      ];
    }

    if (position > param + PARAM_EPSILON) {
      return [
        normalizeOpeningOnWall(
          {
            ...opening,
            wallId: secondWallId,
            positionOnEdge: (position - param) / (1 - param)
          },
          secondWall
        )
      ];
    }

    return [
      normalizeOpeningOnWall(
        {
          ...opening,
          positionOnEdge: 1 - PARAM_EPSILON
        },
        firstWall
      )
    ];
  });

  return {
    walls: nextWalls,
    openings: normalizeOpeningElements(nextOpenings, nextWalls),
    splitPoint
  };
}

export function remapOpeningsForWallChange(
  openings: OpeningElement[],
  previousWalls: Wall[],
  nextWalls: Wall[]
) {
  return normalizeOpeningElements(remapOpenings(openings, previousWalls, nextWalls), nextWalls);
}
