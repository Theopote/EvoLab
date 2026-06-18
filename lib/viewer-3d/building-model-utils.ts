import type { PlanVersion, Point } from "@/lib/project-types";

export const ROOM_LABEL_LOD_THRESHOLD = 30;

export function getGridColumnPositions(version: PlanVersion): Point[] {
  const grid = version.building?.grids?.[0];

  if (!grid?.lines.length) {
    return [];
  }

  const xValues = Array.from(
    new Set(grid.lines.filter((line) => line.axis === "x").map((line) => line.start[0]))
  ).sort((a, b) => a - b);
  const yValues = Array.from(
    new Set(grid.lines.filter((line) => line.axis === "y").map((line) => line.start[1]))
  ).sort((a, b) => a - b);

  const points: Point[] = [];

  xValues.forEach((x) => {
    yValues.forEach((y) => {
      points.push([x, y]);
    });
  });

  return points;
}

export function shouldRenderRoomLabels(roomCount: number) {
  return roomCount <= ROOM_LABEL_LOD_THRESHOLD;
}
