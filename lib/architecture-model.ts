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
import { edgeKey, extractWallsFromRooms, polygonEdges } from "@/lib/wall-extractor";

export type PlanVersionDraft = Omit<PlanVersion, "levels" | "building"> &
  Partial<Pick<PlanVersion, "levels" | "building">>;

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

function paramOnWall(point: Point, wall: Wall) {
  const length = distance(wall.start, wall.end);

  if (length < 0.001) {
    return 0.5;
  }

  const t =
    ((point[0] - wall.start[0]) * (wall.end[0] - wall.start[0]) +
      (point[1] - wall.start[1]) * (wall.end[1] - wall.start[1])) /
    (length * length);

  return Math.max(0.05, Math.min(0.95, t));
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

export function remapOpenings(previousOpenings: OpeningElement[], previousWalls: Wall[], nextWalls: Wall[]) {
  const previousWallById = new Map(previousWalls.map((wall) => [wall.id, wall]));
  const nextWallByKey = new Map(nextWalls.map((wall) => [edgeKey(wall.start, wall.end), wall]));

  return previousOpenings
    .map((opening) => {
      const previousWall = previousWallById.get(opening.wallId);

      if (!previousWall) {
        return opening;
      }

      const nextWall = nextWallByKey.get(edgeKey(previousWall.start, previousWall.end));

      if (!nextWall) {
        return undefined;
      }

      const t = paramOnWall(opening.center, previousWall);

      return {
        ...opening,
        wallId: nextWall.id,
        center: lerpPoint(nextWall.start, nextWall.end, t)
      };
    })
    .filter((opening): opening is OpeningElement => Boolean(opening));
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
  const sourceLevels =
    version.levels?.length
      ? version.levels
      : [
          {
            id: "level-01",
            name: "Level 01",
            elevation: 0,
            height: Math.max(3, ...version.rooms.map((room) => room.ceilingHeight)),
            rooms: version.rooms,
            walls: [],
            openings: []
          } satisfies Level
        ];
  const normalizedLevels = sourceLevels.map((sourceLevel, index) => {
    const levelId = sourceLevel.id || `level-${String(index + 1).padStart(2, "0")}`;
    const levelRooms = sourceLevel.rooms.length
      ? sourceLevel.rooms
      : version.rooms.filter((room) => room.levelId === levelId);
    const roomsForLevel = levelRooms.length ? levelRooms : index === 0 ? version.rooms : [];
    const walls = extractWallsFromRooms(roomsForLevel, version.outline);
    const openings =
      sourceLevel.openings.length > 0 && sourceLevel.walls.length > 0
        ? remapOpenings(sourceLevel.openings, sourceLevel.walls, walls)
        : createOpenings(roomsForLevel, walls);
    const rooms = attachElementRefs(roomsForLevel, walls, openings, levelId);
    const boundary: Boundary = {
      id: `boundary-${levelId}`,
      polygon: version.outline,
      type: "level"
    };
    const floor: Floor = {
      id: `floor-${levelId}`,
      levelId,
      outline: version.outline,
      thickness: sourceLevel.floor?.thickness ?? 0.18,
      elevation: sourceLevel.elevation
    };

    return {
      id: levelId,
      name: sourceLevel.name || `Level ${String(index + 1).padStart(2, "0")}`,
      elevation: sourceLevel.elevation,
      height: sourceLevel.height || Math.max(3, ...rooms.map((room) => room.ceilingHeight)),
      rooms,
      walls,
      openings,
      floor,
      boundary
    } satisfies Level;
  });
  const rooms = normalizedLevels.flatMap((level) => level.rooms);
  const floors = normalizedLevels.map((level) => level.floor).filter((floor): floor is Floor => Boolean(floor));
  const cores = normalizedLevels.flatMap((level) => createCores(level.id, level.rooms, level.walls));
  const firstBoundary = normalizedLevels[0]?.boundary ?? {
    id: "boundary-level-01",
    polygon: version.outline,
    type: "level" as const
  };
  const building: Building = {
    id: version.building?.id ?? `building-${version.id}`,
    name: version.building?.name ?? version.label,
    boundary: {
      ...firstBoundary,
      id: "boundary-building",
      type: "building"
    },
    levels: normalizedLevels,
    floors,
    cores,
    grids: version.building?.grids?.length ? version.building.grids : [createGrid(version)]
  };

  return {
    ...version,
    rooms,
    levels: normalizedLevels,
    building
  };
}

export function normalizeProjectVersions(versions: PlanVersionDraft[]) {
  return versions.map((version) => normalizePlanVersion(version));
}
