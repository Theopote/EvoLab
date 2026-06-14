import type { OpeningElement, PlanVersion, Point, Room, Wall } from "@/lib/project-types";

export const zoneColors: Record<Room["zone"], string> = {
  public: "rgba(79, 181, 200, 0.24)",
  semi_public: "rgba(132, 204, 22, 0.2)",
  private: "rgba(167, 139, 250, 0.2)",
  service: "rgba(230, 162, 60, 0.2)",
  circulation: "rgba(148, 163, 184, 0.18)"
};

export const zoneStrokes: Record<Room["zone"], string> = {
  public: "#4fb5c8",
  semi_public: "#84cc16",
  private: "#a78bfa",
  service: "#e6a23c",
  circulation: "#94a3b8"
};

export function polygonPoints(points: Point[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function getCentroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function wallLength(wall: Wall) {
  return distance(wall.start, wall.end);
}

export function wallAngle(wall: Wall) {
  return Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0]);
}

export function wallNormal(wall: Wall): Point {
  const angle = wallAngle(wall);
  return [-Math.sin(angle), Math.cos(angle)];
}

export function findOpeningWall(opening: OpeningElement, walls: Wall[]) {
  return walls.find((wall) => wall.id === opening.wallId);
}

export function openingSegment(opening: OpeningElement, wall: Wall): { start: Point; end: Point } {
  const angle = wallAngle(wall);
  const dx = Math.cos(angle) * opening.width * 0.5;
  const dy = Math.sin(angle) * opening.width * 0.5;

  return {
    start: [opening.center[0] - dx, opening.center[1] - dy],
    end: [opening.center[0] + dx, opening.center[1] + dy]
  };
}

export function getViewBox(version: PlanVersion, padding = 8) {
  return `${-padding} ${-padding} ${version.overallBounds.width + padding * 2} ${
    version.overallBounds.height + padding * 2
  }`;
}
