import type { OpeningElement, Point, Wall } from "@/lib/project-types";

const OPENING_EDGE_MARGIN = 0.05;
const OPENING_POSITION_MIN = 0.05;
const OPENING_POSITION_MAX = 0.95;

function wallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

export function openingPositionOnWall(opening: OpeningElement, wall: Wall): number {
  const length = wallLength(wall);

  if (length < 0.001) {
    return 0.5;
  }

  const t =
    ((opening.center[0] - wall.start[0]) * (wall.end[0] - wall.start[0]) +
      (opening.center[1] - wall.start[1]) * (wall.end[1] - wall.start[1])) /
    (length * length);

  return Math.max(OPENING_POSITION_MIN, Math.min(OPENING_POSITION_MAX, t));
}

export function openingCenterFromPosition(wall: Wall, position: number): Point {
  const t = Math.max(OPENING_POSITION_MIN, Math.min(OPENING_POSITION_MAX, position));

  return [
    wall.start[0] + (wall.end[0] - wall.start[0]) * t,
    wall.start[1] + (wall.end[1] - wall.start[1]) * t
  ];
}

export function openingPositionLimits(wall: Wall, width: number) {
  const length = wallLength(wall);

  if (length < 0.001 || width > length - OPENING_EDGE_MARGIN * 2) {
    return undefined;
  }

  const halfRatio = width / 2 / length;

  return {
    min: OPENING_POSITION_MIN + halfRatio,
    max: OPENING_POSITION_MAX - halfRatio
  };
}

export function openingFitsOnWall(wall: Wall, width: number, position: number) {
  const limits = openingPositionLimits(wall, width);

  if (!limits) {
    return false;
  }

  return position >= limits.min - 0.0001 && position <= limits.max + 0.0001;
}
