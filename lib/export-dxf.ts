import { resolveLevelOutline, resolveLevelRooms } from "@/lib/level-rooms";
import { resolveExportLevelGeometry } from "@/lib/geometry/walls/export-authoritative-walls";
import type { Level, OpeningElement, PlanVersion, Point, Room, Wall } from "@/lib/project-types";
import { deriveVerticalElements } from "@/lib/vertical-elements";

export const DXF_EXPORT_LAYERS = {
  WALL_EXTERNAL: "EVOLAB-WALL-EXTERNAL",
  WALL_INTERNAL: "EVOLAB-WALL-INTERNAL",
  OPENING_DOOR: "EVOLAB-OPENING-DOOR",
  OPENING_WINDOW: "EVOLAB-OPENING-WINDOW",
  ROOM_BOUNDARY: "EVOLAB-ROOM-BOUNDARY",
  ROOM_TEXT: "EVOLAB-ROOM-TEXT",
  COLUMN: "EVOLAB-COLUMN",
  CORE: "EVOLAB-CORE",
  GRID: "EVOLAB-GRID",
  FLOOR: "EVOLAB-FLOOR"
} as const;

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

function appendTable(lines: string[], name: string, entries: string[][]): void {
  lines.push(...dxfPair(0, "TABLE"), ...dxfPair(2, name), ...dxfPair(70, entries.length));
  for (const entry of entries) {
    lines.push(...entry);
  }
  lines.push(...dxfPair(0, "ENDTAB"));
}

export function resolveWallExportLayer(wall: Wall): string {
  switch (wall.type) {
    case "external":
      return DXF_EXPORT_LAYERS.WALL_EXTERNAL;
    case "core":
      return DXF_EXPORT_LAYERS.CORE;
    case "internal":
    case "partition":
    default:
      return DXF_EXPORT_LAYERS.WALL_INTERNAL;
  }
}

export function resolveOpeningExportLayer(opening: OpeningElement): string {
  return opening.type === "window" ? DXF_EXPORT_LAYERS.OPENING_WINDOW : DXF_EXPORT_LAYERS.OPENING_DOOR;
}

function levelFloorLayerName(level: Level, levelCount: number): string {
  if (levelCount <= 1) {
    return DXF_EXPORT_LAYERS.FLOOR;
  }

  const slug = level.name.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || level.id;
  return `${DXF_EXPORT_LAYERS.FLOOR}-${slug}`.slice(0, 255);
}

function roomCentroid(room: Room): Point {
  const total = room.polygon.reduce(
    (acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }),
    { x: 0, y: 0 }
  );

  return [total.x / room.polygon.length, total.y / room.polygon.length];
}

function lineEntity(layer: string, start: Point, end: Point): string[] {
  return [
    ...dxfPair(0, "LINE"),
    ...dxfPair(8, layer),
    ...dxfPair(10, start[0]),
    ...dxfPair(20, start[1]),
    ...dxfPair(30, 0),
    ...dxfPair(11, end[0]),
    ...dxfPair(21, end[1]),
    ...dxfPair(31, 0)
  ];
}

function circleEntity(layer: string, center: Point, radius: number): string[] {
  return [
    ...dxfPair(0, "CIRCLE"),
    ...dxfPair(8, layer),
    ...dxfPair(10, center[0]),
    ...dxfPair(20, center[1]),
    ...dxfPair(30, 0),
    ...dxfPair(40, radius)
  ];
}

function textEntity(layer: string, position: Point, value: string, height: number): string[] {
  return [
    ...dxfPair(0, "TEXT"),
    ...dxfPair(8, layer),
    ...dxfPair(10, position[0]),
    ...dxfPair(20, position[1]),
    ...dxfPair(30, 0),
    ...dxfPair(40, height),
    ...dxfPair(1, value)
  ];
}

function polylineEntity(layer: string, points: Point[], closed = false): string[] {
  const entity = [
    ...dxfPair(0, "LWPOLYLINE"),
    ...dxfPair(8, layer),
    ...dxfPair(90, points.length),
    ...dxfPair(70, closed ? 1 : 0)
  ];

  for (const [x, y] of points) {
    entity.push(...dxfPair(10, x), ...dxfPair(20, y));
  }

  return entity;
}

function openingLineEntity(opening: OpeningElement, wall: Wall): string[] {
  const dx = wall.end[0] - wall.start[0];
  const dy = wall.end[1] - wall.start[1];
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const half = Math.max(opening.width / 2, 0.05);

  return lineEntity(resolveOpeningExportLayer(opening), [opening.center[0] - ux * half, opening.center[1] - uy * half], [
    opening.center[0] + ux * half,
    opening.center[1] + uy * half
  ]);
}

function isPoint(value: Point | Point[]): value is Point {
  return Array.isArray(value) && value.length === 2 && typeof value[0] === "number" && typeof value[1] === "number";
}

function isPolygon(value: Point | Point[]): value is Point[] {
  return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]);
}

function levelIndexMap(levels: Level[]) {
  const sorted = [...levels].sort((left, right) => (left.floorNumber ?? 0) - (right.floorNumber ?? 0));
  return new Map(sorted.map((level, index) => [level.id, index]));
}

function verticalElementsForLevel(version: PlanVersion, levelId: string, levelOrder: Map<string, number>) {
  const levelIndex = levelOrder.get(levelId);
  if (levelIndex === undefined) {
    return [];
  }

  const elements = version.verticalElements ?? deriveVerticalElements(version);

  return elements.filter((element) => {
    const fromIndex = levelOrder.get(element.appliesFromFloorId);
    const toIndex = levelOrder.get(element.appliesToFloorId);
    if (fromIndex === undefined || toIndex === undefined) {
      return element.appliesFromFloorId === levelId || element.appliesToFloorId === levelId;
    }

    const minIndex = Math.min(fromIndex, toIndex);
    const maxIndex = Math.max(fromIndex, toIndex);
    return levelIndex >= minIndex && levelIndex <= maxIndex;
  });
}

function layerTableEntry(name: string): string[] {
  return [
    ...dxfPair(0, "LAYER"),
    ...dxfPair(2, name),
    ...dxfPair(70, 0),
    ...dxfPair(62, 7),
    ...dxfPair(6, "CONTINUOUS")
  ];
}

function appendRoomEntities(
  entities: string[][],
  usedLayers: Set<string>,
  rooms: Room[]
): void {
  for (const room of rooms) {
    if (room.polygon.length >= 3) {
      entities.push(polylineEntity(DXF_EXPORT_LAYERS.ROOM_BOUNDARY, room.polygon, true));
      usedLayers.add(DXF_EXPORT_LAYERS.ROOM_BOUNDARY);
    }

    const center = roomCentroid(room);
    entities.push(textEntity(DXF_EXPORT_LAYERS.ROOM_TEXT, [center[0], center[1] + 0.35], room.name, 0.35));
    entities.push(
      textEntity(
        DXF_EXPORT_LAYERS.ROOM_TEXT,
        [center[0], center[1] - 0.45],
        `${room.areaSqm.toFixed(1)} m2`,
        0.25
      )
    );
    usedLayers.add(DXF_EXPORT_LAYERS.ROOM_TEXT);
  }
}

function appendVerticalElementEntities(
  entities: string[][],
  usedLayers: Set<string>,
  elements: ReturnType<typeof verticalElementsForLevel>
): void {
  for (const element of elements) {
    if (element.kind === "column") {
      const point = element.position;
      if (isPoint(point)) {
        entities.push(circleEntity(DXF_EXPORT_LAYERS.COLUMN, point, 0.2));
        usedLayers.add(DXF_EXPORT_LAYERS.COLUMN);
      }
      continue;
    }

    if (element.kind === "core" || element.kind === "shear_wall") {
      const polygon = element.position;
      if (isPolygon(polygon) && polygon.length >= 3) {
        entities.push(polylineEntity(DXF_EXPORT_LAYERS.CORE, polygon, true));
        usedLayers.add(DXF_EXPORT_LAYERS.CORE);
      }
    }
  }
}

export function createDxfExportDocument(version: PlanVersion): string {
  const entities: string[][] = [];
  const usedLayers = new Set<string>();
  const levelOrder = levelIndexMap(version.levels);
  const levelCount = version.levels.length;

  for (const level of version.levels) {
    const geometry = resolveExportLevelGeometry(level);
    const rooms = resolveLevelRooms(level, version.standardFloorGroups);
    const floorOutline = resolveLevelOutline(level, version.standardFloorGroups, version.outline);
    const floorLayer = levelFloorLayerName(level, levelCount);

    if (floorOutline.length >= 3) {
      entities.push(polylineEntity(floorLayer, floorOutline, true));
      usedLayers.add(floorLayer);
    }

    appendRoomEntities(entities, usedLayers, rooms);

    if (geometry.authoritative) {
      const wallById = new Map(geometry.walls.map((wall) => [wall.id, wall]));

      for (const wall of geometry.walls) {
        const layer = resolveWallExportLayer(wall);
        entities.push(lineEntity(layer, wall.start, wall.end));
        usedLayers.add(layer);
      }

      for (const opening of geometry.openings) {
        const wall = wallById.get(opening.wallId);
        if (!wall) {
          continue;
        }

        entities.push(openingLineEntity(opening, wall));
        usedLayers.add(resolveOpeningExportLayer(opening));
      }
    }

    appendVerticalElementEntities(entities, usedLayers, verticalElementsForLevel(version, level.id, levelOrder));
  }

  for (const grid of version.building.grids) {
    for (const line of grid.lines) {
      entities.push(lineEntity(DXF_EXPORT_LAYERS.GRID, line.start, line.end));
      usedLayers.add(DXF_EXPORT_LAYERS.GRID);
    }
  }

  const lines: string[] = [];
  appendSection(lines, "HEADER", [
    dxfPair(9, "$ACADVER"),
    dxfPair(1, "AC1015"),
    dxfPair(9, "$INSUNITS"),
    dxfPair(70, 6),
    dxfPair(9, "$MEASUREMENT"),
    dxfPair(70, 1)
  ]);

  lines.push(...dxfPair(0, "SECTION"), ...dxfPair(2, "TABLES"));
  appendTable(lines, "LAYER", [...usedLayers].sort().map((layer) => layerTableEntry(layer)));
  lines.push(...dxfPair(0, "ENDSEC"));

  appendSection(lines, "ENTITIES", entities);
  lines.push(...dxfPair(0, "EOF"));

  return `${lines.join("\n")}\n`;
}
