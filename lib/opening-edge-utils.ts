import type { OpeningElement, Point, Wall } from "@/lib/project-types";
import { openingCenterFromPosition, openingPositionOnWall } from "@/lib/opening-wall-utils";
import { edgeKey } from "@/lib/wall-extractor";
import { edgeKeyToWallId, wallIdToEdgeKey } from "@/lib/wall-graph";

export function wallEdgeIdFromWall(wall: Wall) {
  return edgeKey(wall.start, wall.end);
}

export function wallIdFromWallEdgeId(wallEdgeId: string) {
  if (wallEdgeId.startsWith("wall-")) {
    return wallEdgeId;
  }

  return edgeKeyToWallId(wallEdgeId);
}

export function resolveWallForOpening(opening: OpeningElement, walls: Wall[]): Wall | undefined {
  if (opening.wallEdgeId) {
    const wallId = wallIdFromWallEdgeId(opening.wallEdgeId);
    const byId = walls.find((wall) => wall.id === wallId);

    if (byId) {
      return byId;
    }

    const edgeKeyValue = opening.wallEdgeId.startsWith("wall-")
      ? wallIdToEdgeKey(opening.wallEdgeId)
      : opening.wallEdgeId;

    return walls.find((wall) => edgeKey(wall.start, wall.end) === edgeKeyValue);
  }

  return walls.find((wall) => wall.id === opening.wallId);
}

export function normalizeOpeningElement(opening: OpeningElement, walls: Wall[]): OpeningElement {
  const wall = resolveWallForOpening(opening, walls);

  if (!wall) {
    return opening;
  }

  const wallEdgeId = wallEdgeIdFromWall(wall);
  const positionOnEdge =
    opening.positionOnEdge ?? openingPositionOnWall({ ...opening, wallId: wall.id }, wall);
  const center = openingCenterFromPosition(wall, positionOnEdge);

  return {
    ...opening,
    wallId: wall.id,
    wallEdgeId,
    positionOnEdge,
    center
  };
}

export function normalizeOpeningElements(openings: OpeningElement[], walls: Wall[]) {
  return openings.map((opening) => normalizeOpeningElement(opening, walls));
}

export function remapOpeningByWallEdge(
  opening: OpeningElement,
  previousWalls: Wall[],
  nextWalls: Wall[]
): OpeningElement | undefined {
  const normalized = normalizeOpeningElement(opening, previousWalls);
  const positionOnEdge = normalized.positionOnEdge ?? 0.5;
  const nextWallById = nextWalls.find((wall) => wall.id === normalized.wallId);

  if (nextWallById) {
    return normalizeOpeningElement(
      {
        ...normalized,
        wallId: nextWallById.id,
        positionOnEdge,
        center: openingCenterFromPosition(nextWallById, positionOnEdge)
      },
      nextWalls
    );
  }

  const nextWall = resolveWallForOpening(
    { ...normalized, wallId: "", wallEdgeId: normalized.wallEdgeId },
    nextWalls
  );

  if (!nextWall) {
    return undefined;
  }

  return normalizeOpeningElement(
    {
      ...normalized,
      wallId: nextWall.id,
      wallEdgeId: wallEdgeIdFromWall(nextWall),
      positionOnEdge,
      center: openingCenterFromPosition(nextWall, positionOnEdge)
    },
    nextWalls
  );
}

export function openingEdgeParamFromCenter(wall: Wall, center: Point) {
  return openingPositionOnWall({ wallId: wall.id, center } as OpeningElement, wall);
}

export function openingCenterFromEdgeParam(wall: Wall, positionOnEdge: number): Point {
  return openingCenterFromPosition(wall, positionOnEdge);
}
