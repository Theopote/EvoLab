import type { OpeningElement, PlanVersion, Room } from "@/lib/project-types";
import { extractWallsFromRooms } from "@/lib/wall-extractor";

export const hasWindow = (version: PlanVersion, room: Room) => {
  const openings: OpeningElement[] = version.levels?.[0]?.openings ?? [];
  return openings.length
    ? openings.some((opening) => opening.type === "window" && opening.roomIds?.includes(room.id))
    : room.windows.length > 0;
};

export const hasExternalWall = (version: PlanVersion, room: Room) => {
  const walls = version.levels?.[0]?.walls?.length
    ? version.levels[0].walls
    : extractWallsFromRooms(version.rooms, version.outline);

  return walls.some((wall) => wall.type === "external" && wall.roomIds.includes(room.id));
};

export const roomDepthEstimate = (room: Room) => {
  const xs = room.polygon.map(([x]) => x);
  const ys = room.polygon.map(([, y]) => y);
  return Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};
