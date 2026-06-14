import type { AnalysisLayerId, PlanVersion, Point, Room } from "@/lib/project-types";

export interface AnalysisRoomOverlay {
  roomId: string;
  name: string;
  center: Point;
  areaSqm: number;
  zone: Room["zone"];
}

export interface AnalysisPathOverlay {
  id: string;
  points: Point[];
}

export interface AnalysisVectorOverlay {
  id: string;
  from: Point;
  to: Point;
}

export interface AnalysisDistanceOverlay {
  roomId: string;
  center: Point;
  distance: number;
}

export interface AnalysisResult {
  versionId: string;
  requestedLayers: AnalysisLayerId[];
  rooms: AnalysisRoomOverlay[];
  daylightRooms: Array<AnalysisRoomOverlay & { radius: number }>;
  ventilationVectors: AnalysisVectorOverlay[];
  sightlineCone?: Point[];
  patientFlow?: AnalysisPathOverlay;
  staffFlow?: AnalysisPathOverlay;
  cleanDirtyFlow?: {
    clean?: AnalysisPathOverlay;
    dirty?: AnalysisPathOverlay;
  };
  egressPaths: AnalysisPathOverlay[];
  egressDistances: AnalysisDistanceOverlay[];
  corePoint: Point;
  coreLines: AnalysisVectorOverlay[];
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function roomByType(version: PlanVersion, types: Room["type"][]) {
  return version.rooms.find((room) => types.includes(room.type));
}

function nearestCorePoint(version: PlanVersion): Point {
  const core = roomByType(version, ["stair", "elevator", "shaft"]);
  return core ? centroid(core) : [version.overallBounds.width / 2, version.overallBounds.height / 2];
}

function hasWindowOpening(version: PlanVersion, room: Room) {
  const openings = version.levels[0]?.openings ?? [];

  if (openings.length === 0) {
    return room.windows.length > 0;
  }

  return openings.some((opening) => opening.type === "window" && opening.roomIds?.includes(room.id));
}

function roomOverlay(room: Room): AnalysisRoomOverlay {
  return {
    roomId: room.id,
    name: room.name,
    center: centroid(room),
    areaSqm: room.areaSqm,
    zone: room.zone
  };
}

function pathFromRooms(id: string, rooms: Array<Room | undefined>): AnalysisPathOverlay | undefined {
  const points = rooms.filter(Boolean).map((room) => centroid(room as Room));
  return points.length >= 2 ? { id, points } : undefined;
}

export function computeAnalysis(version: PlanVersion, requestedLayers: AnalysisLayerId[]): AnalysisResult {
  const roomOverlays = version.rooms.map(roomOverlay);
  const publicRoom = roomByType(version, ["lobby"]) ?? version.rooms[0];
  const corridor = roomByType(version, ["corridor"]);
  const consultation = roomByType(version, ["consultation"]);
  const office = roomByType(version, ["office"]);
  const service = roomByType(version, ["equipment_room", "shaft"]);
  const corePoint = nearestCorePoint(version);

  return {
    versionId: version.id,
    requestedLayers,
    rooms: roomOverlays,
    daylightRooms: version.rooms
      .filter((room) => room.needsDaylight || hasWindowOpening(version, room))
      .map((room) => ({
        ...roomOverlay(room),
        radius: Math.max(3, Math.sqrt(room.areaSqm) / 2.8)
      })),
    ventilationVectors: version.rooms
      .filter((room) => hasWindowOpening(version, room))
      .map((room) => {
        const [x, y] = centroid(room);
        return {
          id: `vent-${room.id}`,
          from: [x - 3, y],
          to: [x + 3, y - 2]
        };
      }),
    sightlineCone:
      publicRoom && corridor
        ? [
            centroid(publicRoom),
            [centroid(corridor)[0] - 6, centroid(corridor)[1] - 10],
            [centroid(corridor)[0] + 6, centroid(corridor)[1] + 10]
          ]
        : undefined,
    patientFlow: pathFromRooms("patient-flow", [publicRoom, corridor, consultation]),
    staffFlow: pathFromRooms("staff-flow", [office, corridor, consultation ?? office]),
    cleanDirtyFlow: {
      dirty: pathFromRooms("dirty-flow", [service, corridor]),
      clean: pathFromRooms("clean-flow", [publicRoom, corridor])
    },
    egressPaths: version.rooms
      .filter((room) => room.type !== "stair" && room.type !== "elevator" && room.type !== "shaft")
      .map((room) => ({
        id: `egress-${room.id}`,
        points: [centroid(room), corePoint]
      })),
    egressDistances: version.rooms.map((room) => {
      const center = centroid(room);
      return {
        roomId: room.id,
        center,
        distance: Math.hypot(center[0] - corePoint[0], center[1] - corePoint[1])
      };
    }),
    corePoint,
    coreLines: version.rooms.map((room) => ({
      id: `core-${room.id}`,
      from: corePoint,
      to: centroid(room)
    }))
  };
}
