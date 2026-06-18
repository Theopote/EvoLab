import { castRayFan, wallSegments } from "@/lib/analysis/raycasting";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

export function computeSightlineCone(version: PlanVersion, originRoom: Room, targetRoom?: Room): Point[] | undefined {
  const origin = centroid(originRoom);
  const target = targetRoom ? centroid(targetRoom) : undefined;
  const walls = version.levels[0]?.walls ?? [];
  const obstacles = wallSegments(walls, false);
  const maxDistance = Math.max(version.overallBounds.width, version.overallBounds.height);

  if (target) {
    const baseAngle = Math.atan2(target[1] - origin[1], target[0] - origin[0]);
    const spread = Math.PI / 5;
    return castRayFan(origin, baseAngle - spread, baseAngle + spread, 12, maxDistance, obstacles);
  }

  return castRayFan(origin, -Math.PI / 3, Math.PI / 3, 16, maxDistance, obstacles);
}
