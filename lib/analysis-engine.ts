import { computeDaylightSamples } from "@/lib/analysis/daylight";
import { buildRoomGraph, findNearestExitPath, findRoomPath, pathLength } from "@/lib/analysis/graph";
import { computeSightlineCone } from "@/lib/analysis/sightline";
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
  distance?: number;
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
  daylightRooms: Array<AnalysisRoomOverlay & { radius: number; penetration?: number }>;
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
  const level = room.levelId
    ? version.levels.find((item) => item.id === room.levelId) ?? version.levels[0]
    : version.levels[0];
  const openings = level?.openings ?? [];

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

function pathOverlay(id: string, points: Point[] | undefined): AnalysisPathOverlay | undefined {
  if (!points || points.length < 2) {
    return undefined;
  }

  return {
    id,
    points,
    distance: pathLength(points)
  };
}

function wantsAnyLayer(requestedLayers: AnalysisLayerId[], layers: AnalysisLayerId[]) {
  return layers.some((layer) => requestedLayers.includes(layer));
}

function computeFlowPaths(version: PlanVersion, graph: ReturnType<typeof buildRoomGraph>) {
  const publicRoom = roomByType(version, ["lobby"]) ?? version.rooms[0];
  const corridor = roomByType(version, ["corridor"]);
  const consultation = roomByType(version, ["consultation"]);
  const office = roomByType(version, ["office"]);
  const service = roomByType(version, ["equipment_room", "shaft"]);

  const patientFlow =
    publicRoom && corridor
      ? pathOverlay(
          "patient-flow",
          consultation
            ? findRoomPath(graph, publicRoom.id, consultation.id)
            : findRoomPath(graph, publicRoom.id, corridor.id)
        )
      : undefined;

  const staffFlow =
    office && corridor
      ? pathOverlay(
          "staff-flow",
          consultation
            ? findRoomPath(graph, office.id, consultation.id)
            : findRoomPath(graph, office.id, corridor.id)
        )
      : undefined;

  const dirtyFlow =
    service && corridor ? pathOverlay("dirty-flow", findRoomPath(graph, service.id, corridor.id)) : undefined;
  const cleanFlow =
    publicRoom && corridor ? pathOverlay("clean-flow", findRoomPath(graph, publicRoom.id, corridor.id)) : undefined;

  return {
    patientFlow,
    staffFlow,
    cleanDirtyFlow: {
      dirty: dirtyFlow,
      clean: cleanFlow
    }
  };
}

function computeEgress(version: PlanVersion, graph: ReturnType<typeof buildRoomGraph>) {
  const egressPaths: AnalysisPathOverlay[] = [];
  const egressDistances: AnalysisDistanceOverlay[] = [];

  version.rooms
    .filter((room) => !["stair", "elevator", "shaft"].includes(room.type))
    .forEach((room) => {
      const route = findNearestExitPath(graph, version, room.id);

      if (route) {
        egressPaths.push({
          id: `egress-${room.id}`,
          points: route.path,
          distance: route.distance
        });
        egressDistances.push({
          roomId: room.id,
          center: centroid(room),
          distance: route.distance
        });
        return;
      }

      const corePoint = nearestCorePoint(version);
      const center = centroid(room);
      egressPaths.push({
        id: `egress-${room.id}`,
        points: [center, corePoint],
        distance: Math.hypot(center[0] - corePoint[0], center[1] - corePoint[1])
      });
      egressDistances.push({
        roomId: room.id,
        center,
        distance: Math.hypot(center[0] - corePoint[0], center[1] - corePoint[1])
      });
    });

  return { egressPaths, egressDistances };
}

export function computeAnalysis(
  version: PlanVersion,
  requestedLayers: AnalysisLayerId[],
  levelId?: string
): AnalysisResult {
  const level = levelId
    ? version.levels.find((item) => item.id === levelId) ?? version.levels[0]
    : version.levels[0];
  const scopedVersion: PlanVersion = {
    ...version,
    rooms: level?.rooms ?? version.rooms,
    levels: level ? [level] : version.levels
  };
  const roomOverlays = scopedVersion.rooms.map(roomOverlay);
  const corePoint = nearestCorePoint(scopedVersion);
  const needsGraph = wantsAnyLayer(requestedLayers, [
    "patient_flow",
    "staff_flow",
    "clean_dirty_flow",
    "egress_path",
    "egress_distance"
  ]);
  const graph = needsGraph ? buildRoomGraph(scopedVersion) : undefined;

  const daylightCandidates = scopedVersion.rooms.filter(
    (room) => room.needsDaylight || hasWindowOpening(scopedVersion, room)
  );
  const daylightSamples =
    requestedLayers.includes("daylight") && daylightCandidates.length > 0
      ? computeDaylightSamples(scopedVersion, daylightCandidates)
      : [];

  const flowPaths = graph && wantsAnyLayer(requestedLayers, ["patient_flow", "staff_flow", "clean_dirty_flow"])
    ? computeFlowPaths(scopedVersion, graph)
    : undefined;

  const egress =
    graph && wantsAnyLayer(requestedLayers, ["egress_path", "egress_distance"])
      ? computeEgress(scopedVersion, graph)
      : { egressPaths: [], egressDistances: [] };

  const publicRoom = roomByType(scopedVersion, ["lobby"]) ?? scopedVersion.rooms[0];
  const corridor = roomByType(scopedVersion, ["corridor"]);
  const consultation = roomByType(scopedVersion, ["consultation"]);

  return {
    versionId: version.id,
    requestedLayers,
    rooms: roomOverlays,
    daylightRooms: daylightSamples.map((sample) => {
      const room = daylightCandidates.find((item) => item.id === sample.roomId);

      return {
        ...(room ? roomOverlay(room) : roomOverlays.find((item) => item.roomId === sample.roomId)!),
        radius: sample.radius,
        penetration: sample.penetration
      };
    }),
    ventilationVectors: requestedLayers.includes("ventilation")
      ? scopedVersion.rooms
          .filter((room) => hasWindowOpening(scopedVersion, room))
          .map((room) => {
            const [x, y] = centroid(room);
            return {
              id: `vent-${room.id}`,
              from: [x - 3, y],
              to: [x + 3, y - 2]
            };
          })
      : [],
    sightlineCone:
      requestedLayers.includes("sightline") && publicRoom
        ? computeSightlineCone(scopedVersion, publicRoom, corridor ?? consultation)
        : undefined,
    patientFlow: requestedLayers.includes("patient_flow") ? flowPaths?.patientFlow : undefined,
    staffFlow: requestedLayers.includes("staff_flow") ? flowPaths?.staffFlow : undefined,
    cleanDirtyFlow: requestedLayers.includes("clean_dirty_flow") ? flowPaths?.cleanDirtyFlow : undefined,
    egressPaths: requestedLayers.includes("egress_path") ? egress.egressPaths : [],
    egressDistances: requestedLayers.includes("egress_distance") ? egress.egressDistances : [],
    corePoint,
    coreLines: requestedLayers.includes("core_efficiency")
      ? scopedVersion.rooms.map((room) => ({
          id: `core-${room.id}`,
          from: corePoint,
          to: centroid(room)
        }))
      : []
  };
}

export interface BuildingAnalysisSummary {
  versionId: string;
  levelSummaries: Array<{
    levelId: string;
    levelName: string;
    maxEgressDistance: number;
    daylightFailureCount: number;
    grossArea: number;
  }>;
  worstEgressDistance: number;
  totalDaylightFailures: number;
  totalGrossArea: number;
}

export function computeBuildingAnalysis(
  version: PlanVersion,
  requestedLayers: AnalysisLayerId[]
): BuildingAnalysisSummary {
  const levelSummaries = version.levels.map((level) => {
    const analysis = computeAnalysis(version, requestedLayers, level.id);
    const maxEgressDistance = Math.max(0, ...analysis.egressDistances.map((item) => item.distance));
    const daylightFailureCount = version.rooms
      .filter((room) => room.levelId === level.id && room.needsDaylight)
      .filter((room) => !hasWindowOpening({ ...version, levels: [level], rooms: level.rooms }, room)).length;
    const grossArea = level.rooms.reduce((total, room) => total + room.areaSqm, 0);

    return {
      levelId: level.id,
      levelName: level.name,
      maxEgressDistance,
      daylightFailureCount,
      grossArea
    };
  });

  return {
    versionId: version.id,
    levelSummaries,
    worstEgressDistance: Math.max(0, ...levelSummaries.map((item) => item.maxEgressDistance)),
    totalDaylightFailures: levelSummaries.reduce((total, item) => total + item.daylightFailureCount, 0),
    totalGrossArea: levelSummaries.reduce((total, item) => total + item.grossArea, 0)
  };
}
