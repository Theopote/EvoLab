import { findLevelForRoom, levelGeometryForRoom, resolveLevelRooms } from "@/lib/level-rooms";
import { pointInPolygon } from "@/lib/geometry-kernel";
import { castRay, polygonSegments, type Segment } from "@/lib/analysis/raycasting";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function roomExternalSegments(version: PlanVersion, room: Room): Segment[] {
  const { walls, outline } = levelGeometryForRoom(version, room);
  const externalFromWalls = walls
    .filter((wall) => wall.type === "external" && wall.roomIds.includes(room.id))
    .map((wall) => ({ start: wall.start, end: wall.end }));

  if (externalFromWalls.length > 0) {
    return externalFromWalls;
  }

  const outlineSegments = polygonSegments(outline);
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
}

function inwardNormal(segment: Segment, roomPolygon: Point[]): Point {
  const mid: Point = [(segment.start[0] + segment.end[0]) / 2, (segment.start[1] + segment.end[1]) / 2];
  const edge: Point = [segment.end[0] - segment.start[0], segment.end[1] - segment.start[1]];
  const normalCandidates: Point[] = [
    [-edge[1], edge[0]],
    [edge[1], -edge[0]]
  ];
  const chosen =
    normalCandidates.find((normal) => {
      const probe: Point = [mid[0] + normal[0] * 0.2, mid[1] + normal[1] * 0.2];
      return pointInPolygon(probe, roomPolygon);
    }) ?? normalCandidates[0];

  const length = Math.hypot(chosen[0], chosen[1]) || 1;
  return [chosen[0] / length, chosen[1] / length];
}

function buildOccluders(version: PlanVersion, room: Room): Segment[] {
  const level = findLevelForRoom(version, room);
  const roomsOnLevel = level
    ? resolveLevelRooms(level, version.standardFloorGroups).filter((item) => item.id !== room.id)
    : version.rooms.filter((item) => item.id !== room.id);

  return roomsOnLevel.flatMap((item) => polygonSegments(item.polygon));
}

export interface DaylightSample {
  roomId: string;
  center: Point;
  radius: number;
  penetration: number;
}

export function computeDaylightSamples(version: PlanVersion, rooms: Room[]): DaylightSample[] {
  const maxProbe = Math.max(version.overallBounds.width, version.overallBounds.height);

  return rooms.map((room) => {
    const center = centroid(room);
    const externalSegments = roomExternalSegments(version, room);
    const occluders = buildOccluders(version, room);
    let penetration = Math.max(3, Math.sqrt(room.areaSqm) / 2.5);

    if (externalSegments.length > 0) {
      const penetrations = externalSegments.map((segment) => {
        const origin: Point = [(segment.start[0] + segment.end[0]) / 2, (segment.start[1] + segment.end[1]) / 2];
        const normal = inwardNormal(segment, room.polygon);
        const hit = castRay(origin, normal, maxProbe, occluders);
        return Math.hypot(hit[0] - origin[0], hit[1] - origin[1]);
      });

      penetration = Math.max(3, Math.min(maxProbe, Math.max(...penetrations)));
    }

    return {
      roomId: room.id,
      center,
      radius: Math.max(3, Math.min(penetration, Math.sqrt(room.areaSqm) * 0.85)),
      penetration
    };
  });
}
