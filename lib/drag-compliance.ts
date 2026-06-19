import type { Room } from "@/lib/project-types";
import { measureCorridorsClearWidth } from "@/lib/rules/metrics/corridor-width";

const CORRIDOR_MIN_WIDTH = 1.2;

export function corridorComplianceRoomIds(rooms: Room[]): string[] {
  return measureCorridorsClearWidth(rooms)
    .filter((item) => item.clearWidthM < CORRIDOR_MIN_WIDTH - 0.001)
    .map((item) => item.roomId);
}
