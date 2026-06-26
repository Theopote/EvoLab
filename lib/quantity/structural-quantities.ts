import { buildStructuralSystem } from "@/lib/project-domain";
import type { StructuralSystem } from "@/lib/building-domain";
import { resolveLevelRooms } from "@/lib/level-rooms";
import type { PlanVersion } from "@/lib/project-types";

export interface StructuralQuantitySummary {
  columnConcreteM3: number;
  beamConcreteM3: number;
  slabConcreteM3: number;
  stairConcreteM3: number;
  shearWallConcreteM3: number;
  totalConcreteM3: number;
  rebarWeightKg: number;
  slabAreaSqm: number;
  stairCount: number;
}

const DEFAULT_FLOOR_SLAB_THICKNESS_M = 0.15;
const DEFAULT_COLUMN_HEIGHT_M = 3.6;
const DEFAULT_BEAM_DEPTH_M = 0.5;
const DEFAULT_SHEAR_WALL_HEIGHT_M = 3.6;
const DEFAULT_STAIR_VOLUME_M3 = 12;
const REBAR_KG_PER_M3 = 85;

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function slabAreaForVersion(version: PlanVersion) {
  return version.levels.reduce((total, level) => {
    const rooms = resolveLevelRooms(level, version.standardFloorGroups);
    const levelArea = rooms.reduce((sum, room) => sum + room.areaSqm, 0);
    return total + levelArea;
  }, 0);
}

export function estimateStructuralQuantities(
  version: PlanVersion,
  structuralSystem?: StructuralSystem
): StructuralQuantitySummary {
  const structure = structuralSystem ?? buildStructuralSystem(version);
  const slabAreaSqm = slabAreaForVersion(version);
  const slabConcreteM3 = slabAreaSqm * DEFAULT_FLOOR_SLAB_THICKNESS_M;

  const columnConcreteM3 = structure.columns.reduce((total, column) => {
    return total + column.width * column.depth * DEFAULT_COLUMN_HEIGHT_M;
  }, 0);

  const beamConcreteM3 = structure.beams.reduce((total, beam) => {
    const span = Math.hypot(beam.end[0] - beam.start[0], beam.end[1] - beam.start[1]);
    return total + span * beam.depth * 0.3;
  }, 0);

  const shearWallConcreteM3 = structure.shearWalls.reduce((total, wall) => {
    const length = Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
    return total + length * wall.thickness * DEFAULT_SHEAR_WALL_HEIGHT_M;
  }, 0);

  const stairRooms = version.levels.flatMap((level) =>
    resolveLevelRooms(level, version.standardFloorGroups).filter((room) => room.type === "stair")
  );
  const stairCount = stairRooms.length;
  const stairConcreteM3 = stairCount * DEFAULT_STAIR_VOLUME_M3;

  const totalConcreteM3 =
    columnConcreteM3 + beamConcreteM3 + slabConcreteM3 + stairConcreteM3 + shearWallConcreteM3;
  const rebarWeightKg = totalConcreteM3 * REBAR_KG_PER_M3;

  return {
    columnConcreteM3: round(columnConcreteM3, 2),
    beamConcreteM3: round(beamConcreteM3, 2),
    slabConcreteM3: round(slabConcreteM3, 2),
    stairConcreteM3: round(stairConcreteM3, 2),
    shearWallConcreteM3: round(shearWallConcreteM3, 2),
    totalConcreteM3: round(totalConcreteM3, 2),
    rebarWeightKg: round(rebarWeightKg, 0),
    slabAreaSqm: round(slabAreaSqm),
    stairCount
  };
}
