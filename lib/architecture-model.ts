import type {
  Boundary,
  Building,
  Core,
  Floor,
  Grid,
  GridLine,
  Level,
  Opening,
  OpeningElement,
  PlanVersion,
  Point,
  Room,
  Wall
} from "@/lib/project-types";

export type PlanVersionDraft = Omit<PlanVersion, "levels" | "building"> &
  Partial<Pick<PlanVersion, "levels" | "building">>;

function round(value: number, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pointKey(point: Point) {
  return `${round(point[0])},${round(point[1])}`;
}

function edgeKey(start: Point, end: Point) {
  const a = pointKey(start);
  const b = pointKey(end);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function roomCenter(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function polygonEdges(points: Point[]) {
  return points.map((start, index) => ({
    start,
    end: points[(index + 1) % points.length]
  }));
}

function edgeOrientation(start: Point, end: Point) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dy >= 0 ? "south" : "north";
  }

  return dx >= 0 ? "east" : "west";
}

function openingEdgeScore(room: Room, opening: Opening, start: Point, end: Point) {
  const [cx, cy] = roomCenter(room);
  const [mx, my] = midpoint(start, end);
  const orientation = opening.wall;
  const directionPenalty =
    (orientation === "north" && my <= cy) ||
    (orientation === "south" && my >= cy) ||
    (orientation === "east" && mx >= cx) ||
    (orientation === "west" && mx <= cx)
      ? 0
      : 10000;

  const axisPenalty =
    edgeOrientation(start, end) === orientation || edgeOrientation(end, start) === orientation ? 0 : 1000;

  return directionPenalty + axisPenalty + distance([cx, cy], [mx, my]);
}

function findLegacyOpeningWall(opening: Opening, room: Room, wallsByKey: Map<string, Wall>) {
  const edges = polygonEdges(room.polygon);
  const edge = [...edges].sort(
    (a, b) =>
      openingEdgeScore(room, opening, a.start, a.end) -
      openingEdgeScore(room, opening, b.start, b.end)
  )[0];

  return edge ? wallsByKey.get(edgeKey(edge.start, edge.end)) : undefined;
}

function createGrid(version: PlanVersionDraft): Grid {
  const spacing = 12;
  const xCount = Math.max(2, Math.floor(version.overallBounds.width / spacing) + 1);
  const yCount = Math.max(2, Math.floor(version.overallBounds.height / spacing) + 1);
  const xLines: GridLine[] = Array.from({ length: xCount }, (_, index) => {
    const x = Math.min(version.overallBounds.width, index * spacing);

    return {
      id: `grid-x-${index + 1}`,
      label: String(index + 1),
      start: [x, 0],
      end: [x, version.overallBounds.height],
      axis: "x"
    };
  });
  const yLines: GridLine[] = Array.from({ length: yCount }, (_, index) => {
    const y = Math.min(version.overallBounds.height, index * spacing);

    return {
      id: `grid-y-${index + 1}`,
      label: String.fromCharCode(65 + index),
      start: [0, y],
      end: [version.overallBounds.width, y],
      axis: "y"
    };
  });

  return {
    id: "grid-primary",
    name: "Primary planning grid",
    lines: [...xLines, ...yLines]
  };
}

function createWalls(rooms: Room[], outline: Point[]): Wall[] {
  const wallMap = new Map<string, Wall>();
  const outlineKeys = new Set(polygonEdges(outline).map((edge) => edgeKey(edge.start, edge.end)));

  rooms.forEach((room) => {
    polygonEdges(room.polygon).forEach((edge) => {
      const key = edgeKey(edge.start, edge.end);
      const existing = wallMap.get(key);

      if (existing) {
        existing.roomIds = Array.from(new Set([...existing.roomIds, room.id]));
        existing.type = existing.type === "core" || room.type === "shaft" ? "core" : "internal";
        return;
      }

      const isCore = ["stair", "elevator", "shaft"].includes(room.type);
      wallMap.set(key, {
        id: `wall-${wallMap.size + 1}`,
        start: edge.start,
        end: edge.end,
        thickness: isCore ? 0.32 : outlineKeys.has(key) ? 0.3 : 0.18,
        height: Math.max(2.7, room.ceilingHeight),
        type: isCore ? "core" : outlineKeys.has(key) ? "external" : "partition",
        roomIds: [room.id]
      });
    });
  });

  return [...wallMap.values()].map((wall) => ({
    ...wall,
    type: wall.roomIds.length > 1 && wall.type !== "core" ? "internal" : wall.type
  }));
}

function createOpenings(rooms: Room[], walls: Wall[]) {
  const wallsByKey = new Map(walls.map((wall) => [edgeKey(wall.start, wall.end), wall]));
  const openings: OpeningElement[] = [];

  rooms.forEach((room) => {
    const legacyOpenings = [
      ...room.doors.map((opening) => ({ ...opening, type: "door" as const, height: 2.1, sillHeight: undefined })),
      ...room.windows.map((opening) => ({ ...opening, type: "window" as const, height: 1.5, sillHeight: 0.9 }))
    ];

    legacyOpenings.forEach((opening) => {
      const wall = findLegacyOpeningWall(opening, room, wallsByKey);

      if (!wall) {
        return;
      }

      openings.push({
        id: `${opening.type}-${room.id}-${openings.length + 1}`,
        wallId: wall.id,
        type: opening.type,
        center: lerpPoint(wall.start, wall.end, opening.position),
        width: opening.width,
        height: opening.height,
        sillHeight: opening.sillHeight,
        roomIds: [room.id]
      });
    });
  });

  return openings;
}

function attachElementRefs(rooms: Room[], walls: Wall[], openings: OpeningElement[], levelId: string): Room[] {
  return rooms.map((room) => ({
    ...room,
    levelId: room.levelId ?? levelId,
    wallIds: walls.filter((wall) => wall.roomIds.includes(room.id)).map((wall) => wall.id),
    openingIds: openings.filter((opening) => opening.roomIds?.includes(room.id)).map((opening) => opening.id)
  }));
}

function createCores(levelId: string, rooms: Room[], walls: Wall[]): Core[] {
  const coreRooms = rooms.filter((room) => ["stair", "elevator", "shaft"].includes(room.type));

  if (coreRooms.length === 0) {
    return [];
  }

  return [
    {
      id: "core-vertical-01",
      levelIds: [levelId],
      roomIds: coreRooms.map((room) => room.id),
      wallIds: walls.filter((wall) => wall.type === "core").map((wall) => wall.id),
      type: coreRooms.some((room) => room.type === "shaft") ? "mixed" : "elevator"
    }
  ];
}

export function normalizePlanVersion(version: PlanVersionDraft): PlanVersion {
  const levelId = version.levels?.[0]?.id ?? "level-01";
  const levelName = version.levels?.[0]?.name ?? "Level 01";
  const levelHeight =
    version.levels?.[0]?.height ??
    Math.max(3, ...version.rooms.map((room) => room.ceilingHeight));
  const walls = createWalls(version.rooms, version.outline);
  const openings = createOpenings(version.rooms, walls);
  const rooms = attachElementRefs(version.rooms, walls, openings, levelId);
  const boundary: Boundary = {
    id: `boundary-${levelId}`,
    polygon: version.outline,
    type: "level"
  };
  const floor: Floor = {
    id: `floor-${levelId}`,
    levelId,
    outline: version.outline,
    thickness: 0.18,
    elevation: 0
  };
  const level: Level = {
    id: levelId,
    name: levelName,
    elevation: version.levels?.[0]?.elevation ?? 0,
    height: levelHeight,
    rooms,
    walls,
    openings,
    floor,
    boundary
  };
  const cores = createCores(levelId, rooms, walls);
  const building: Building = {
    id: version.building?.id ?? `building-${version.id}`,
    name: version.building?.name ?? version.label,
    boundary: {
      ...boundary,
      id: "boundary-building",
      type: "building"
    },
    levels: [level],
    floors: [floor],
    cores,
    grids: version.building?.grids?.length ? version.building.grids : [createGrid(version)]
  };

  return {
    ...version,
    rooms,
    levels: [level],
    building
  };
}

export function normalizeProjectVersions(versions: PlanVersionDraft[]) {
  return versions.map((version) => normalizePlanVersion(version));
}
