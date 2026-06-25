import { remapOpenings } from "@/lib/architecture-model";
import { normalizeOpeningElements } from "@/lib/opening-edge-utils";
import { edgeKey, extractWallsFromRooms } from "@/lib/wall-extractor";
import { pointsNear, WALL_GRAPH_TOLERANCE } from "@/lib/wall-graph";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";
import {
  openingsAlignWithWalls,
  shouldPreserveAuthoritativeWalls
} from "@/lib/geometry/walls/authoritative-walls";

function clonePoint(point: Point): Point {
  return [...point] as Point;
}

function cloneWall(wall: Wall): Wall {
  return {
    ...wall,
    start: clonePoint(wall.start),
    end: clonePoint(wall.end),
    roomIds: [...wall.roomIds]
  };
}

function segmentsMatch(
  aStart: Point,
  aEnd: Point,
  bStart: Point,
  bEnd: Point,
  tolerance = WALL_GRAPH_TOLERANCE
) {
  return (
    (pointsNear(aStart, bStart, tolerance) && pointsNear(aEnd, bEnd, tolerance)) ||
    (pointsNear(aStart, bEnd, tolerance) && pointsNear(aEnd, bStart, tolerance))
  );
}

function wallKeyForWall(wall: Wall) {
  return edgeKey(wall.start, wall.end);
}

export function wallsAlignWithRoomGraph(walls: Wall[], rooms: Room[], levelOutline: Point[]): boolean {
  const extracted = extractWallsFromRooms(rooms, levelOutline);
  const extractedKeys = new Set(extracted.map((wall) => wallKeyForWall(wall)));

  if (walls.length !== extracted.length) {
    return false;
  }

  return walls.every((wall) => extractedKeys.has(wallKeyForWall(wall)));
}

export function reconcileAuthoritativeWalls(
  sourceWalls: Wall[],
  rooms: Room[],
  levelOutline: Point[]
): Wall[] {
  const extracted = extractWallsFromRooms(rooms, levelOutline);
  const preservedByKey = new Map<string, Wall>();
  const usedIds = new Set<string>();

  sourceWalls.forEach((wall) => {
    preservedByKey.set(wallKeyForWall(wall), wall);
  });

  return extracted.map((candidate) => {
    const key = wallKeyForWall(candidate);
    const preserved = preservedByKey.get(key);

    if (preserved) {
      usedIds.add(preserved.id);

      return {
        ...preserved,
        start: clonePoint(candidate.start),
        end: clonePoint(candidate.end),
        roomIds: [...candidate.roomIds],
        type: candidate.type,
        thickness: preserved.thickness ?? candidate.thickness,
        height: Math.max(preserved.height, candidate.height)
      };
    }

    const fuzzy = sourceWalls.find(
      (wall) => !usedIds.has(wall.id) && segmentsMatch(wall.start, wall.end, candidate.start, candidate.end)
    );

    if (fuzzy) {
      usedIds.add(fuzzy.id);

      return {
        ...fuzzy,
        start: clonePoint(candidate.start),
        end: clonePoint(candidate.end),
        roomIds: [...candidate.roomIds],
        type: candidate.type
      };
    }

    return cloneWall(candidate);
  });
}

export function syncLevelWallsFromRooms(
  level: Pick<Level, "walls" | "openings">,
  rooms: Room[],
  levelOutline: Point[]
): { walls: Wall[]; openings: OpeningElement[] } {
  const walls = shouldPreserveAuthoritativeWalls(level)
    ? reconcileAuthoritativeWalls(level.walls, rooms, levelOutline)
    : extractWallsFromRooms(rooms, levelOutline);

  const rawOpenings =
    level.openings.length > 0
      ? remapOpenings(level.openings, level.walls, walls)
      : [];

  return {
    walls,
    openings: normalizeOpeningElements(rawOpenings, walls)
  };
}

export function syncLevelGeometryFromRooms(level: Level, rooms: Room[], levelOutline: Point[]): Level {
  const { walls, openings } = syncLevelWallsFromRooms(level, rooms, levelOutline);

  return {
    ...level,
    rooms,
    walls,
    openings
  };
}
