import { normalizePlanVersion } from "@/lib/architecture-model";
import { addProtrusion, createProtrusionPlacement } from "@/lib/add-protrusion";
import type { BoundarySpanSelection } from "@/lib/boundary-span-select";
import { getResolvedLevel } from "@/lib/level-rooms";
import { resolveBayWindowGfaThresholds } from "@/lib/gfa-exemption";
import { enforceOpeningConstraintsOnVersion } from "@/lib/opening-constraints";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import {
  applyBoundaryReshape,
  applyOpeningPolicyOnReshape,
  mockArcPoints,
  openingsOnBoundarySpan,
  spanIncludesSharedEdge,
  syncSharedVerticesOnReshape
} from "@/lib/reshape-boundary";
import type { PlanVersion, Point, RoomProtrusion, Wall } from "@/lib/project-types";
import { deriveWallGraph } from "@/lib/wall-graph";
import type { ScoringConfig } from "@/lib/building-domain";

export function buildReshapedPreviewVersion(
  baseVersion: PlanVersion,
  span: BoundarySpanSelection,
  newPoints: Point[],
  options?: {
    openingPolicy?: "preserve" | "remove";
    levelId?: string;
  }
) {
  const level =
    baseVersion.levels.find((item) => item.id === options?.levelId) ?? baseVersion.levels[0];
  const rooms = level ? (getResolvedLevel(baseVersion, level.id)?.rooms ?? baseVersion.rooms) : baseVersion.rooms;
  const room = rooms.find((item) => item.id === span.roomId);

  if (!room) {
    throw new Error(`Room ${span.roomId} was not found in the active level.`);
  }

  const graph = deriveWallGraph(rooms);

  if (spanIncludesSharedEdge(span, room.polygon, graph)) {
    throw new Error("Boundary span includes a shared interior wall. Select an exterior or exclusive edge span.");
  }

  const reshaped = applyBoundaryReshape(room, span, newPoints);
  const syncedRooms = syncSharedVerticesOnReshape(rooms, room.id, room.polygon, reshaped.polygon);
  const draft: PlanVersion = {
    ...baseVersion,
    rooms: syncedRooms,
    levels: baseVersion.levels.map((currentLevel) =>
      currentLevel.id === level?.id ? { ...currentLevel, rooms: syncedRooms } : currentLevel
    )
  };

  const normalized = normalizePlanVersion(draft);
  const normalizedLevel = normalized.levels.find((item) => item.id === level?.id) ?? normalized.levels[0];
  const previousWalls = level?.walls ?? [];
  const nextWalls = normalizedLevel?.walls ?? [];
  const affectedOpenings = openingsOnBoundarySpan(
    room.id,
    span,
    room,
    previousWalls,
    level?.openings ?? []
  );
  const openingPolicy = options?.openingPolicy ?? "preserve";
  const openingResult = applyOpeningPolicyOnReshape(
    level?.openings ?? [],
    affectedOpenings.map((opening) => opening.id),
    openingPolicy,
    previousWalls,
    nextWalls
  );

  const withOpenings: PlanVersion = {
    ...normalized,
    levels: normalized.levels.map((currentLevel) =>
      currentLevel.id === level?.id ? { ...currentLevel, openings: openingResult.openings } : currentLevel
    )
  };

  const openingEnforced = enforceOpeningConstraintsOnVersion(withOpenings);

  return {
    version: postProcessPlanVersion(openingEnforced.version),
    openingRepairs: [...openingResult.repairs, ...openingEnforced.repairs],
    affectedOpeningIds: affectedOpenings.map((opening) => opening.id)
  };
}

export function buildProtrusionPreviewVersion(
  baseVersion: PlanVersion,
  roomId: string,
  protrusion: RoomProtrusion,
  options?: {
    levelId?: string;
    scoringConfig?: ScoringConfig;
  }
) {
  const level =
    baseVersion.levels.find((item) => item.id === options?.levelId) ?? baseVersion.levels[0];
  const rooms = level ? (getResolvedLevel(baseVersion, level.id)?.rooms ?? baseVersion.rooms) : baseVersion.rooms;
  const room = rooms.find((item) => item.id === roomId);

  if (!room) {
    throw new Error(`Room ${roomId} was not found in the active level.`);
  }

  const gfaThresholds = resolveBayWindowGfaThresholds(options?.scoringConfig?.gfaExemption?.bayWindow);
  const nextRoom = addProtrusion(room, protrusion, baseVersion.outline, gfaThresholds);

  if (!nextRoom) {
    throw new Error("Protrusion union failed — footprint may be invalid or outside the site outline.");
  }

  const nextRooms = rooms.map((item) => (item.id === roomId ? nextRoom : item));
  const draft: PlanVersion = {
    ...baseVersion,
    rooms: nextRooms,
    levels: baseVersion.levels.map((currentLevel) =>
      currentLevel.id === level?.id ? { ...currentLevel, rooms: nextRooms } : currentLevel
    )
  };

  const normalized = normalizePlanVersion(draft);
  const openingEnforced = enforceOpeningConstraintsOnVersion(normalized);

  return {
    version: postProcessPlanVersion(openingEnforced.version),
    gfaBasis:
      nextRoom.protrusions?.[nextRoom.protrusions.length - 1]?.gfaExemptBasis ??
      gfaThresholds.notice
  };
}

export function mockReshapePoints(span: BoundarySpanSelection, instruction: string) {
  if (/弧|arc|curve|圆|round/i.test(instruction)) {
    return mockArcPoints(span);
  }

  return mockArcPoints(span, 8);
}

export function mockProtrusionFromWall(
  wall: Wall,
  positionOnEdge: number,
  widthM: number,
  instruction: string,
  hostPolygon?: Point[]
) {
  const depthM = /深|deep/i.test(instruction) ? 0.6 : 0.45;
  const type = /阳台|balcony/i.test(instruction) ? "balcony" : /壁龛|niche/i.test(instruction) ? "niche" : "bay_window";
  return createProtrusionPlacement(wall, positionOnEdge, widthM, depthM, type, hostPolygon);
}
