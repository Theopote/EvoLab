import { resolveWallForOpening } from "@/lib/opening-edge-utils";
import type { Level, OpeningElement, Wall } from "@/lib/project-types";

const MIN_AUTHORITATIVE_WALLS = 4;

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
