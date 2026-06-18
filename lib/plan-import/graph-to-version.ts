import type { RecognizedLevelGraph, RecognizedPlanGraph } from "@/lib/schemas/recognized-plan-graph-schema";
import type { PlanVersionDraft } from "@/lib/architecture-model";
import type { Level, OpeningElement, Point, Room, Wall } from "@/lib/project-types";
import { polygonArea } from "@/lib/plan-validation";

const DEFAULT_WALL_THICKNESS = 0.2;
const DEFAULT_CEILING_HEIGHT = 3;
const LABEL_ROOM_SIZE = 4;

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function collectPoints(graph: RecognizedPlanGraph) {
  const points: Point[] = [];

  graph.levels.forEach((level) => {
    level.walls.forEach((wall) => {
      points.push(wall.start, wall.end);
    });
    level.openings.forEach((opening) => {
      points.push(opening.center);
    });
    level.roomPolygons.forEach((room) => {
      points.push(...room.polygon);
    });
    level.roomLabels.forEach((label) => {
      points.push(label.center);
    });
    level.dimensionAnnotations.forEach((dimension) => {
      points.push(dimension.start, dimension.end);
    });
  });

  return points;
}

function inferPixelsPerMeter(graph: RecognizedPlanGraph, points: Point[]) {
  if (graph.scale?.pixelsPerMeter) {
    return graph.scale.pixelsPerMeter;
  }

  for (const level of graph.levels) {
    for (const dimension of level.dimensionAnnotations) {
      const pixelLength = distance(dimension.start, dimension.end);
      const match = dimension.text.match(/(\d+(?:\.\d+)?)\s*(?:m|mm|cm)?/i);

      if (!match || pixelLength < 1) {
        continue;
      }

      let meters = Number(match[1]);

      if (/mm/i.test(dimension.text)) {
        meters /= 1000;
      } else if (/cm/i.test(dimension.text)) {
        meters /= 100;
      }

      if (meters > 0) {
        return pixelLength / meters;
      }
    }
  }

  const maxCoord = Math.max(...points.map((point) => Math.max(Math.abs(point[0]), Math.abs(point[1]))), 1);

  if (maxCoord > 2000) {
    return 1000;
  }

  if (maxCoord > 200) {
    return 100;
  }

  if (graph.scale?.referenceDimensionMeters) {
    return 40;
  }

  return 40;
}

function toMeters(point: Point, origin: Point, pixelsPerMeter: number): Point {
  return [(point[0] - origin[0]) / pixelsPerMeter, (point[1] - origin[1]) / pixelsPerMeter];
}

function inferRoomType(name: string): Room["type"] {
  const normalized = name.toLowerCase();

  if (/corridor|hall|passage|走道|走廊/.test(normalized)) {
    return "corridor";
  }

  if (/lobby|reception|门厅|大堂/.test(normalized)) {
    return "lobby";
  }

  if (/stair|楼梯/.test(normalized)) {
    return "stair";
  }

  if (/elevator|lift|电梯/.test(normalized)) {
    return "elevator";
  }

  if (/bath|wc|toilet|卫|厕/.test(normalized)) {
    return "bathroom";
  }

  if (/kitchen|厨/.test(normalized)) {
    return "kitchen";
  }

  if (/bed|卧室/.test(normalized)) {
    return "bedroom";
  }

  if (/office|办公/.test(normalized)) {
    return "office";
  }

  if (/consult|诊/.test(normalized)) {
    return "consultation";
  }

  if (/ward|病房/.test(normalized)) {
    return "ward";
  }

  return "other";
}

function inferRoomZone(type: Room["type"]): Room["zone"] {
  if (type === "corridor" || type === "stair" || type === "elevator" || type === "shaft") {
    return "circulation";
  }

  if (type === "lobby") {
    return "public";
  }

  if (type === "bathroom" || type === "kitchen" || type === "equipment_room") {
    return "service";
  }

  if (type === "consultation" || type === "office") {
    return "semi_public";
  }

  return "private";
}

function labelToPolygon(center: Point, size = LABEL_ROOM_SIZE): Point[] {
  const half = size / 2;

  return [
    [center[0] - half, center[1] - half],
    [center[0] + half, center[1] - half],
    [center[0] + half, center[1] + half],
    [center[0] - half, center[1] + half]
  ];
}

function nearestWallId(center: Point, walls: Wall[]) {
  if (!walls.length) {
    return undefined;
  }

  return [...walls].sort((a, b) => {
    const da = distance(center, midpoint(a.start, a.end));
    const db = distance(center, midpoint(b.start, b.end));
    return da - db;
  })[0]?.id;
}

function buildRooms(level: RecognizedLevelGraph, walls: Wall[], metersPerPoint: (point: Point) => Point): Room[] {
  const roomsFromPolygons = level.roomPolygons.map((room, index) => {
    const polygon = room.polygon.map(metersPerPoint);
    const type = room.type ?? inferRoomType(room.name);

    return {
      id: room.id || `room-${index + 1}`,
      name: room.name,
      type,
      zone: room.zone ?? inferRoomZone(type),
      polygon,
      areaSqm: Math.max(6, Math.round(polygonArea(polygon))),
      ceilingHeight: DEFAULT_CEILING_HEIGHT,
      doors: [],
      windows: [],
      adjacents: []
    } satisfies Room;
  });

  if (roomsFromPolygons.length) {
    return roomsFromPolygons;
  }

  return level.roomLabels.map((label, index) => {
    const center = metersPerPoint(label.center);
    const type = label.type ?? inferRoomType(label.name);
    const polygon = labelToPolygon(center);

    return {
      id: `room-label-${index + 1}`,
      name: label.name,
      type,
      zone: label.zone ?? inferRoomZone(type),
      polygon,
      areaSqm: Math.max(6, Math.round(polygonArea(polygon))),
      ceilingHeight: DEFAULT_CEILING_HEIGHT,
      doors: [],
      windows: [],
      adjacents: []
    } satisfies Room;
  });
}

function buildWalls(level: RecognizedLevelGraph, metersPerPoint: (point: Point) => Point, rooms: Room[]): Wall[] {
  return level.walls.map((wall, index) => {
    const start = metersPerPoint(wall.start);
    const end = metersPerPoint(wall.end);
    const roomIds = rooms
      .filter((room) => room.polygon.some((point) => distance(point, start) < 2 || distance(point, end) < 2))
      .map((room) => room.id);

    return {
      id: wall.id || `wall-${index + 1}`,
      start,
      end,
      thickness: wall.thickness ?? DEFAULT_WALL_THICKNESS,
      height: DEFAULT_CEILING_HEIGHT,
      type: wall.type ?? (roomIds.length > 1 ? "internal" : "partition"),
      roomIds
    } satisfies Wall;
  });
}

function buildOpenings(
  level: RecognizedLevelGraph,
  walls: Wall[],
  metersPerPoint: (point: Point) => Point
): OpeningElement[] {
  return level.openings.map((opening, index) => {
    const center = metersPerPoint(opening.center);

    return {
      id: opening.id || `opening-${index + 1}`,
      wallId: opening.wallId ?? nearestWallId(center, walls) ?? walls[0]?.id ?? "wall-01",
      type: opening.type,
      center,
      width: opening.width,
      height: opening.height ?? (opening.type === "window" ? 1.5 : 2.1),
      sillHeight: opening.sillHeight ?? (opening.type === "window" ? 0.9 : undefined),
      roomIds: []
    } satisfies OpeningElement;
  });
}

function buildLevel(
  level: RecognizedLevelGraph,
  index: number,
  origin: Point,
  pixelsPerMeter: number,
  outline: Point[]
): Level {
  const metersPerPoint = (point: Point) => toMeters(point, origin, pixelsPerMeter);
  const rooms = buildRooms(level, [], metersPerPoint);
  const walls = buildWalls(level, metersPerPoint, rooms);
  const openings = buildOpenings(level, walls, metersPerPoint);
  const levelId = `level-${String(index + 1).padStart(2, "0")}`;

  return {
    id: levelId,
    name: level.name,
    elevation: level.elevation ?? index * 3,
    height: DEFAULT_CEILING_HEIGHT,
    rooms: rooms.map((room) => ({
      ...room,
      levelId
    })),
    walls,
    openings,
    boundary: {
      id: `boundary-${levelId}`,
      polygon: outline,
      type: "level"
    }
  };
}

export function buildPlanVersionFromGraph(
  graph: RecognizedPlanGraph,
  options?: { label?: string; fileName?: string }
): PlanVersionDraft {
  const points = collectPoints(graph);

  if (!points.length) {
    throw new Error("Recognized plan graph has no geometry.");
  }

  const minX = Math.min(...points.map((point) => point[0]));
  const minY = Math.min(...points.map((point) => point[1]));
  const maxX = Math.max(...points.map((point) => point[0]));
  const maxY = Math.max(...points.map((point) => point[1]));
  const origin: Point = [minX, minY];
  const pixelsPerMeter = inferPixelsPerMeter(graph, points);
  const width = Math.max(8, (maxX - minX) / pixelsPerMeter + 2);
  const height = Math.max(8, (maxY - minY) / pixelsPerMeter + 2);
  const outline: Point[] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ];
  const levels = graph.levels.map((level, index) => buildLevel(level, index, origin, pixelsPerMeter, outline));
  const rooms = levels.flatMap((level) => level.rooms);
  const timestamp = new Date().toISOString();
  const label = options?.label ?? (options?.fileName ? `Imported / ${options.fileName}` : "Imported Plan");

  return {
    id: `imported-${Date.now()}`,
    label,
    createdAt: timestamp,
    outline,
    overallBounds: { width, height },
    rooms,
    levels,
    metadata: {
      strategy: "plan-import",
      topology: {
        circulation: "Imported from drawing recognition.",
        core: levels.some((level) => level.rooms.some((room) => room.type === "stair" || room.type === "elevator"))
          ? "Core spaces detected in import."
          : "No dedicated core detected.",
        daylight: "Daylight assumptions not inferred from import.",
        plumbing: "Plumbing zones not inferred from import."
      }
    }
  };
}

export function estimateGraphConfidence(graph: RecognizedPlanGraph) {
  const level = graph.levels[0];
  let score = 0.35;

  if (level.walls.length >= 4) {
    score += 0.2;
  }

  if (level.roomPolygons.length >= 2 || level.roomLabels.length >= 2) {
    score += 0.2;
  }

  if (level.openings.length > 0) {
    score += 0.1;
  }

  if (graph.scale?.pixelsPerMeter || level.dimensionAnnotations.length > 0) {
    score += 0.1;
  }

  return Math.min(0.95, score);
}
