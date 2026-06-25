import { extractWallsFromRooms } from "@/lib/wall-extractor";
import { reconcileAuthoritativeWalls } from "@/lib/geometry/walls/sync-walls-from-rooms";
import { shouldPreserveAuthoritativeWalls } from "@/lib/geometry/walls/authoritative-walls";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";

export { openingsAlignWithWalls, shouldPreserveAuthoritativeWalls } from "@/lib/geometry/walls/authoritative-walls";

function cloneWall(wall: Wall): Wall {
  return {
    ...wall,
    start: [...wall.start] as Point,
    end: [...wall.end] as Point,
    roomIds: [...wall.roomIds]
  };
}

export function resolveLevelWalls(
  sourceLevel: Pick<Level, "walls" | "openings">,
  roomsForLevel: Room[],
  levelOutline: Point[]
): Wall[] {
  if (!shouldPreserveAuthoritativeWalls(sourceLevel)) {
    return extractWallsFromRooms(roomsForLevel, levelOutline);
  }

  const reconciled = reconcileAuthoritativeWalls(sourceLevel.walls, roomsForLevel, levelOutline);
  const preservedIdCount = reconciled.filter((wall) =>
    sourceLevel.walls.some((sourceWall) => sourceWall.id === wall.id)
  ).length;
  const topologyChanged = reconciled.length !== sourceLevel.walls.length;

  if (topologyChanged || preservedIdCount >= sourceLevel.walls.length) {
    return reconciled;
  }

  return sourceLevel.walls.map(cloneWall);
}

export function resolveLevelRawOpenings(
  sourceLevel: Pick<Level, "openings" | "walls">,
  roomsForLevel: Room[],
  walls: Wall[],
  createOpenings: (rooms: Room[], nextWalls: Wall[]) => OpeningElement[]
): OpeningElement[] {
  if (sourceLevel.openings.length > 0) {
    return sourceLevel.openings;
  }

  return createOpenings(roomsForLevel, walls);
}
