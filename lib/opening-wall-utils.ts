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

export function openingCenterFromDragPoint(wall: Wall, width: number, point: Point): Point | undefined {
  const length = wallLength(wall);

  if (length < 0.001) {
    return undefined;
  }

  const rawPosition =
    ((point[0] - wall.start[0]) * (wall.end[0] - wall.start[0]) +
      (point[1] - wall.start[1]) * (wall.end[1] - wall.start[1])) /
    (length * length);
  const limits = openingPositionLimits(wall, width);

  if (!limits) {
    return undefined;
  }

  const position = Math.max(limits.min, Math.min(limits.max, rawPosition));

  return openingCenterFromPosition(wall, position);
}

export function openingHeightRange(type: OpeningElement["type"], wallHeight: number) {
  return {
    min: type === "door" ? 1.8 : 0.4,
    max: Math.min(wallHeight, type === "door" ? 3 : 3.6)
  };
}

export function openingSillHeightRange(
  type: OpeningElement["type"],
  wallHeight: number,
  height: number
) {
  if (type === "door") {
    return { min: 0, max: 0 };
  }

  const maxSill = Math.max(0, wallHeight - height - 0.1);

  return {
    min: 0,
    max: Math.min(2.5, maxSill)
  };
}

export interface OpeningDraftValidation {
  width?: string;
  position?: string;
  height?: string;
  sillHeight?: string;
}

export function validateOpeningDraft(input: {
  openingType: OpeningElement["type"];
  wall?: Wall;
  wallHeight: number;
  width: number;
  position: number;
  height: number;
  sillHeight: number;
}): OpeningDraftValidation {
  const errors: OpeningDraftValidation = {};
  const wallLengthMeters = input.wall ? wallLength(input.wall) : 0;
  const heightRange = openingHeightRange(input.openingType, input.wallHeight);
  const sillRange = openingSillHeightRange(input.openingType, input.wallHeight, input.height);

  if (!Number.isFinite(input.width) || input.width < 0.4 || input.width > 6) {
    errors.width = "width must be between 0.4 and 6 m";
  } else if (input.wall && input.width > wallLengthMeters - 0.1) {
    errors.width = `width must fit on wall (${wallLengthMeters.toFixed(2)} m)`;
  }

  if (!input.wall) {
    errors.position = "parent wall not found";
  } else if (!Number.isFinite(input.position) || input.position < OPENING_POSITION_MIN || input.position > OPENING_POSITION_MAX) {
    errors.position = `position must be between ${OPENING_POSITION_MIN} and ${OPENING_POSITION_MAX}`;
  } else if (!openingFitsOnWall(input.wall, input.width, input.position)) {
    const limits = openingPositionLimits(input.wall, input.width);
    errors.position = limits
      ? `position must be ${limits.min.toFixed(2)}–${limits.max.toFixed(2)} for this width`
      : "opening does not fit on wall";
  }

  if (!Number.isFinite(input.height) || input.height < heightRange.min || input.height > heightRange.max) {
    errors.height = `height must be between ${heightRange.min} and ${heightRange.max} m`;
  }

  if (input.openingType === "door") {
    if (input.sillHeight > 0.001) {
      errors.sillHeight = "doors use sill height 0";
    }
  } else if (
    !Number.isFinite(input.sillHeight) ||
    input.sillHeight < sillRange.min ||
    input.sillHeight > sillRange.max + 0.0001
  ) {
    errors.sillHeight = `sill height must be between ${sillRange.min} and ${sillRange.max.toFixed(2)} m`;
  }

  return errors;
}
