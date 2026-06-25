import { resolveExportLevelGeometry } from "@/lib/geometry/walls/export-authoritative-walls";
import type { PlanVersion, Point, Wall } from "@/lib/project-types";

function dxfPair(code: number | string, value: number | string): string[] {
  return [String(code), String(value)];
}

function appendSection(lines: string[], name: string, content: string[][]): void {
  lines.push(...dxfPair(0, "SECTION"), ...dxfPair(2, name));
  for (const entity of content) {
    lines.push(...entity);
  }
  lines.push(...dxfPair(0, "ENDSEC"));
}

function wallLayerName(wallId: string): string {
  return `EVOLAB-WALL-${wallId}`.slice(0, 255);
}

function wallLineEntity(wall: Wall): string[] {
  return [
    ...dxfPair(0, "LINE"),
    ...dxfPair(8, wallLayerName(wall.id)),
    ...dxfPair(10, wall.start[0]),
    ...dxfPair(20, wall.start[1]),
    ...dxfPair(30, 0),
    ...dxfPair(11, wall.end[0]),
    ...dxfPair(21, wall.end[1]),
    ...dxfPair(31, 0)
  ];
}

function openingCircleEntity(openingId: string, center: Point, radius: number): string[] {
  return [
    ...dxfPair(0, "CIRCLE"),
    ...dxfPair(8, `EVOLAB-OPENING-${openingId}`.slice(0, 255)),
    ...dxfPair(10, center[0]),
    ...dxfPair(20, center[1]),
    ...dxfPair(30, 0),
    ...dxfPair(40, radius)
  ];
}

export function createDxfExportDocument(version: PlanVersion): string {
  const entities: string[][] = [];

  for (const level of version.levels) {
    const geometry = resolveExportLevelGeometry(level);

    for (const wall of geometry.walls) {
      entities.push(wallLineEntity(wall));
    }

    for (const opening of geometry.openings) {
      entities.push(openingCircleEntity(opening.id, opening.center, Math.max(opening.width / 2, 0.15)));
    }
  }

  const lines: string[] = [];
  appendSection(lines, "HEADER", [dxfPair(9, "$ACADVER"), dxfPair(1, "AC1015")]);
  appendSection(lines, "ENTITIES", entities);
  lines.push(...dxfPair(0, "EOF"));

  return `${lines.join("\n")}\n`;
}
