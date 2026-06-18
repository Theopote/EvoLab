import type { OpeningElement, PlanVersion, Point, Room } from "@/lib/project-types";
import { polygonSegments, type Segment } from "@/lib/analysis/raycasting";
import { extractWallsFromRooms } from "@/lib/wall-extractor";

const roomExternalSegments = (version: PlanVersion, room: Room): Segment[] => {
  const walls = version.levels[0]?.walls ?? [];
  const externalFromWalls = walls
    .filter((wall) => wall.type === "external" && wall.roomIds.includes(room.id))
    .map((wall) => ({ start: wall.start, end: wall.end }));

  if (externalFromWalls.length > 0) {
    return externalFromWalls;
  }

  const outlineSegments = polygonSegments(version.outline);
  const roomSegments = polygonSegments(room.polygon);

  return roomSegments.filter((segment) =>
    outlineSegments.some((outlineSegment) => {
      const sameStart =
        Math.hypot(segment.start[0] - outlineSegment.start[0], segment.start[1] - outlineSegment.start[1]) < 0.2;
      const sameEnd =
        Math.hypot(segment.end[0] - outlineSegment.end[0], segment.end[1] - outlineSegment.end[1]) < 0.2;
      const reversedStart =
        Math.hypot(segment.start[0] - outlineSegment.end[0], segment.start[1] - outlineSegment.end[1]) < 0.2;
      const reversedEnd =
        Math.hypot(segment.end[0] - outlineSegment.start[0], segment.end[1] - outlineSegment.start[1]) < 0.2;
      return (sameStart && sameEnd) || (reversedStart && reversedEnd);
    })
  );
};

const outwardAzimuthDeg = (segment: Segment) => {
  const dx = segment.end[0] - segment.start[0];
  const dy = segment.end[1] - segment.start[1];
  const along = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (along + 90 + 360) % 360;
};

const orientationDeltaDeg = (azimuth: number, preferredDeg: number) => {
  const delta = Math.abs(((azimuth - preferredDeg + 180) % 360) - 180);
  return delta;
};

export const roomFacadeOrientationScore = (version: PlanVersion, room: Room, preferredDeg?: number) => {
  if (preferredDeg === undefined) {
    return 0;
  }

  const segments = roomExternalSegments(version, room);
  if (segments.length === 0) {
    return 0;
  }

  const bestDelta = Math.min(...segments.map((segment) => orientationDeltaDeg(outwardAzimuthDeg(segment), preferredDeg)));
  if (bestDelta <= 30) {
    return 12;
  }
  if (bestDelta <= 60) {
    return 6;
  }

  return 0;
};

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
