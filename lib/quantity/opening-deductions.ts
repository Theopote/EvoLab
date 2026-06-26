import type { OpeningElement, Wall } from "@/lib/project-types";

export interface WallAreaBreakdown {
  grossWallArea: number;
  openingDeductionArea: number;
  netWallArea: number;
  openingsByWall: Record<string, number>;
}

function wallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

function openingArea(opening: OpeningElement) {
  return opening.width * opening.height;
}

export function computeWallAreaWithOpeningDeductions(
  walls: Wall[],
  openings: OpeningElement[]
): WallAreaBreakdown {
  const openingsByWall: Record<string, number> = {};

  for (const opening of openings) {
    if (!opening.wallId) {
      continue;
    }

    openingsByWall[opening.wallId] = (openingsByWall[opening.wallId] ?? 0) + openingArea(opening);
  }

  let grossWallArea = 0;
  let openingDeductionArea = 0;

  for (const wall of walls) {
    const gross = wallLength(wall) * wall.height;
    grossWallArea += gross;

    const deduction = Math.min(gross, openingsByWall[wall.id] ?? 0);
    openingDeductionArea += deduction;
  }

  return {
    grossWallArea,
    openingDeductionArea,
    netWallArea: Math.max(0, grossWallArea - openingDeductionArea),
    openingsByWall
  };
}
