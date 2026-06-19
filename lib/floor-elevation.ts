import type { Level } from "@/lib/project-types";

function levelSortKey(level: Level, fallbackIndex: number) {
  return level.floorNumber ?? fallbackIndex + 1;
}

/** Derive absolute elevation (m) per level from floor numbers and story heights. */
export function computeLevelElevations(levels: Level[]): Map<string, number> {
  if (levels.length === 0) {
    return new Map();
  }

  const indexed = levels.map((level, index) => ({
    level,
    sortKey: levelSortKey(level, index)
  }));
  indexed.sort((a, b) => a.sortKey - b.sortKey);

  const result = new Map<string, number>();
  const groundIdx = indexed.findIndex((item) => item.sortKey >= 1);

  if (groundIdx < 0) {
    let z = 0;
    for (let i = indexed.length - 1; i >= 0; i -= 1) {
      result.set(indexed[i]!.level.id, z);
      z -= indexed[i]!.level.height;
    }
    return result;
  }

  let z = 0;
  for (let i = groundIdx; i < indexed.length; i += 1) {
    result.set(indexed[i]!.level.id, z);
    z += indexed[i]!.level.height;
  }

  z = 0;
  for (let i = groundIdx - 1; i >= 0; i -= 1) {
    z -= indexed[i]!.level.height;
    result.set(indexed[i]!.level.id, z);
  }

  return result;
}

export function applyComputedElevations(levels: Level[]): Level[] {
  const elevations = computeLevelElevations(levels);

  return levels.map((level, index) => {
    const elevation = elevations.get(level.id);
    const floorNumber = level.floorNumber ?? levelSortKey(level, index);

    return {
      ...level,
      floorNumber,
      elevation: elevation ?? level.elevation,
      floor: level.floor ? { ...level.floor, elevation: elevation ?? level.floor.elevation } : level.floor
    };
  });
}
