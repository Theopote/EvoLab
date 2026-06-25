import type { Point, Wall } from "@/lib/project-types";

export function wallUnitNormal(wall: Wall): Point {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy);

  if (length < 0.001) {
    return [0, 1];
  }

  return [-dy / length, dx / length];
}

export function projectDeltaOntoNormal(delta: Point, normal: Point): Point {
  const dot = delta[0] * normal[0] + delta[1] * normal[1];
  return [normal[0] * dot, normal[1] * dot];
}
