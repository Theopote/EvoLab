import { extractWallsFromRooms } from "@/lib/wall-extractor";
import { resolveWallForOpening } from "@/lib/opening-edge-utils";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";

const MIN_AUTHORITATIVE_WALLS = 4;

function cloneWall(wall: Wall): Wall {
  return {
    ...wall,
    start: [...wall.start] as Point,
    end: [...wall.end] as Point,
    roomIds: [...wall.roomIds]
  };
}

export function openingsAlignWithWalls(openings: OpeningElement[], walls: Wall[]): boolean {
  if (!walls.length) {
    return false;
  }

  if (!openings.length) {
    return true;
  }

  return openings.every((opening) => Boolean(resolveWallForOpening(opening, walls)));
}

export function shouldPreserveAuthoritativeWalls(level: Pick<Level, "walls" | "openings">): boolean {
  return level.walls.length >= MIN_AUTHORITATIVE_WALLS && openingsAlignWithWalls(level.openings, level.walls);
}

export function resolveLevelWalls(
  sourceLevel: Pick<Level, "walls" | "openings">,
  roomsForLevel: Room[],
  levelOutline: Point[]
): Wall[] {
  if (shouldPreserveAuthoritativeWalls(sourceLevel)) {
    return sourceLevel.walls.map(cloneWall);
  }

  return extractWallsFromRooms(roomsForLevel, levelOutline);
}

export function resolveLevelRawOpenings(
  sourceLevel: Pick<Level, "openings">,
  roomsForLevel: Room[],
  walls: Wall[],
  createOpenings: (rooms: Room[], nextWalls: Wall[]) => OpeningElement[]
): OpeningElement[] {
  if (sourceLevel.openings.length > 0) {
    return sourceLevel.openings;
  }

  return createOpenings(roomsForLevel, walls);
}
