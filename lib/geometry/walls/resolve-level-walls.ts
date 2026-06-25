import { extractWallsFromRooms } from "@/lib/wall-extractor";
import { reconcileAuthoritativeWalls } from "@/lib/geometry/walls/sync-walls-from-rooms";
import { shouldPreserveAuthoritativeWalls } from "@/lib/geometry/walls/authoritative-walls";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";

export { openingsAlignWithWalls, shouldPreserveAuthoritativeWalls } from "@/lib/geometry/walls/authoritative-walls";

export function resolveLevelWalls(
  sourceLevel: Pick<Level, "walls" | "openings">,
  roomsForLevel: Room[],
  levelOutline: Point[]
): Wall[] {
  if (shouldPreserveAuthoritativeWalls(sourceLevel)) {
    return reconcileAuthoritativeWalls(sourceLevel.walls, roomsForLevel, levelOutline);
  }

  return extractWallsFromRooms(roomsForLevel, levelOutline);
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
