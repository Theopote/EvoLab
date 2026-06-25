import { shouldPreserveAuthoritativeWalls } from "@/lib/geometry/walls/authoritative-walls";
import type { Level, OpeningElement, Point, Wall } from "@/lib/project-types";

export interface ExportLevelGeometry {
  authoritative: boolean;
  walls: Wall[];
  openings: OpeningElement[];
}

function clonePoint(point: Point): Point {
  return [point[0], point[1]];
}

function cloneWall(wall: Wall): Wall {
  return {
    ...wall,
    start: clonePoint(wall.start),
    end: clonePoint(wall.end),
    roomIds: [...wall.roomIds]
  };
}

function cloneOpening(opening: OpeningElement): OpeningElement {
  return {
    ...opening,
    center: clonePoint(opening.center),
    roomIds: [...opening.roomIds]
  };
}

export function resolveExportLevelGeometry(level: Pick<Level, "walls" | "openings">): ExportLevelGeometry {
  if (!shouldPreserveAuthoritativeWalls(level)) {
    return {
      authoritative: false,
      walls: [],
      openings: []
    };
  }

  const walls = level.walls.map(cloneWall);
  const wallIds = new Set(walls.map((wall) => wall.id));
  const openings = level.openings
    .filter((opening) => wallIds.has(opening.wallId))
    .map(cloneOpening);

  return {
    authoritative: true,
    walls,
    openings
  };
}

export function exportAuthoritativeWallNote(levelName: string, authoritative: boolean): string | null {
  if (authoritative) {
    return null;
  }

  return `Storey "${levelName}": walls and openings omitted (export reads authoritative Level.walls only).`;
}
