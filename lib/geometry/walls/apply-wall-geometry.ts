import { remapOpenings } from "@/lib/architecture-model";
import { normalizeOpeningElements } from "@/lib/opening-edge-utils";
import { applyNodeMove } from "@/lib/wall-graph";
import type { Level, Point, Wall } from "@/lib/project-types";
import { findWallEdgeForWall, updateWallEndpoints } from "@/lib/geometry/walls/sync-rooms-from-walls";

export function applyWallGeometryPatch(level: Level, wallId: string, patch: Partial<Wall>): Level {
  const wall = level.walls.find((candidate) => candidate.id === wallId);

  if (!wall) {
    return level;
  }

  const touchesEndpoints = patch.start !== undefined || patch.end !== undefined;

  if (!touchesEndpoints) {
    return {
      ...level,
      walls: level.walls.map((candidate) =>
        candidate.id === wallId ? { ...candidate, ...patch, id: wallId } : candidate
      )
    };
  }

  const nextWall = { ...wall, ...patch, id: wallId };
  const newStart = [...nextWall.start] as Point;
  const newEnd = [...nextWall.end] as Point;
  const edge = findWallEdgeForWall(wall, level.rooms);
  const previousWalls = level.walls;
  const nextWalls = updateWallEndpoints(previousWalls, wallId, newStart, newEnd).map((candidate) =>
    candidate.id === wallId ? { ...candidate, ...patch, id: wallId, start: newStart, end: newEnd } : candidate
  );
  const nextRooms = edge ? applyNodeMove(level.rooms, edge, newStart, newEnd) : level.rooms;
  const nextOpenings = normalizeOpeningElements(
    remapOpenings(level.openings, previousWalls, nextWalls),
    nextWalls
  );

  return { ...level, walls: nextWalls, rooms: nextRooms, openings: nextOpenings };
}
