import { remapOpenings } from "@/lib/architecture-model";
import { normalizeOpeningElements } from "@/lib/opening-edge-utils";
import { extractWallsFromRooms } from "@/lib/wall-extractor";
import {
  applyNodeMove,
  applyWallDragByOffset,
  clampWallDragOffset
} from "@/lib/wall-graph";
import type { Level, Point } from "@/lib/project-types";
import { findWallEdgeForWall, updateWallEndpoints } from "@/lib/geometry/walls/sync-rooms-from-walls";

export function applyLevelWallDrag(
  level: Level,
  wallId: string,
  offset: number,
  normal: Point,
  levelOutline: Point[]
): Level {
  const wall = level.walls.find((candidate) => candidate.id === wallId);
  const rooms = level.rooms;

  if (!wall) {
    const nextRooms = applyWallDragByOffset(rooms, wallId, offset, normal);

    if (nextRooms === rooms) {
      return level;
    }

    const nextWalls = extractWallsFromRooms(nextRooms, levelOutline);
    const nextOpenings = normalizeOpeningElements(
      remapOpenings(level.openings, level.walls, nextWalls),
      nextWalls
    );

    return { ...level, rooms: nextRooms, walls: nextWalls, openings: nextOpenings };
  }

  const edge = findWallEdgeForWall(wall, rooms);

  if (!edge) {
    return level;
  }

  const safeOffset = clampWallDragOffset(offset, rooms, edge, normal);

  if (safeOffset === 0) {
    return level;
  }

  const newStart: Point = [
    edge.nodeA[0] + normal[0] * safeOffset,
    edge.nodeA[1] + normal[1] * safeOffset
  ];
  const newEnd: Point = [
    edge.nodeB[0] + normal[0] * safeOffset,
    edge.nodeB[1] + normal[1] * safeOffset
  ];

  const previousWalls = level.walls;
  const nextWalls = updateWallEndpoints(previousWalls, wallId, newStart, newEnd);
  const nextRooms = applyNodeMove(rooms, edge, newStart, newEnd);
  const nextOpenings = normalizeOpeningElements(
    remapOpenings(level.openings, previousWalls, nextWalls),
    nextWalls
  );

  return { ...level, walls: nextWalls, rooms: nextRooms, openings: nextOpenings };
}
