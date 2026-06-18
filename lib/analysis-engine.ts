import { computeDaylightSamples } from "@/lib/analysis/daylight";
import { computeSemanticEgressForRoom } from "@/lib/analysis/egress-semantics";
import { buildRoomGraph, findRoomPath, pathLength } from "@/lib/analysis/graph";
import { computeSightlineCone } from "@/lib/analysis/sightline";
import {
  canonicalizeAnalysisLayers,
  layerRequested,
  wantsAnyFlowLayer
} from "@/lib/typology/analysis-layers";
import type { FlowDefinition, FlowSegmentDef, TypologyPack } from "@/lib/typology/types";
import { resolveTypologyPack } from "@/lib/typology/resolve";
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

export interface AnalysisServiceFlowOverlay {
  clean?: AnalysisPathOverlay;
  dirty?: AnalysisPathOverlay;
}

export interface AnalysisResult {
  versionId: string;
  requestedLayers: AnalysisLayerId[];
  rooms: AnalysisRoomOverlay[];
  daylightRooms: Array<AnalysisRoomOverlay & { radius: number; penetration?: number }>;
  ventilationVectors: AnalysisVectorOverlay[];
  sightlineCone?: Point[];
  primaryFlow?: AnalysisPathOverlay;
  staffFlow?: AnalysisPathOverlay;
  serviceFlow?: AnalysisServiceFlowOverlay;
  /** @deprecated Use primaryFlow */
  patientFlow?: AnalysisPathOverlay;
  /** @deprecated Use serviceFlow */
  cleanDirtyFlow?: AnalysisServiceFlowOverlay;
  egressPaths: AnalysisPathOverlay[];
  egressDistances: AnalysisDistanceOverlay[];
  corePoint: Point;
  coreLines: AnalysisVectorOverlay[];
}

export interface ComputeAnalysisOptions {
  levelId?: string;
  projectType?: string;
  typologyPack?: TypologyPack;
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function roomByTypes(version: PlanVersion, types: Room["type"][]) {
  return version.rooms.find((room) => types.includes(room.type));
}

function nearestCorePoint(version: PlanVersion): Point {
  const core = roomByTypes(version, ["stair", "elevator", "shaft"]);
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

function resolveSegmentPath(
  version: PlanVersion,
  graph: ReturnType<typeof buildRoomGraph>,
  segment: FlowSegmentDef
): AnalysisPathOverlay | undefined {
  const fromRoom = roomByTypes(version, segment.fromRoomTypes);
  if (!fromRoom) {
    return undefined;
  }

  const targetRoom = roomByTypes(version, segment.toRoomTypes);
  if (!targetRoom) {
    return undefined;
  }

  return pathOverlay(segment.pathId, findRoomPath(graph, fromRoom.id, targetRoom.id));
}

function computeFlowFromDefinition(
  version: PlanVersion,
  graph: ReturnType<typeof buildRoomGraph>,
  flow: FlowDefinition
) {
  if (flow.id === "service" && flow.serviceSplit) {
    return {
      serviceFlow: {
        clean: resolveSegmentPath(version, graph, flow.serviceSplit.clean),
        dirty: resolveSegmentPath(version, graph, flow.serviceSplit.dirty)
      }
    };
  }

  const segment = flow.segments[0];
  if (!segment) {
    return {};
  }

  const path = resolveSegmentPath(version, graph, segment);

  if (flow.id === "primary") {
    return { primaryFlow: path };
  }

  if (flow.id === "staff") {
    return { staffFlow: path };
  }

  if (flow.id === "service") {
    return { serviceFlow: { clean: path } };
  }

  return {};
}

function computeFlowPaths(version: PlanVersion, graph: ReturnType<typeof buildRoomGraph>, pack: TypologyPack) {
  return pack.flowDefinitions.reduce<{
    primaryFlow?: AnalysisPathOverlay;
    staffFlow?: AnalysisPathOverlay;
    serviceFlow?: AnalysisServiceFlowOverlay;
  }>((acc, flow) => {
    const computed = computeFlowFromDefinition(version, graph, flow);
    return {
      primaryFlow: computed.primaryFlow ?? acc.primaryFlow,
      staffFlow: computed.staffFlow ?? acc.staffFlow,
      serviceFlow: computed.serviceFlow ?? acc.serviceFlow
    };
  }, {});
}

function computeEgress(version: PlanVersion) {
  const egressPaths: AnalysisPathOverlay[] = [];
  const egressDistances: AnalysisDistanceOverlay[] = [];

  version.rooms
    .filter((room) => !["stair", "elevator", "shaft"].includes(room.type))
    .forEach((room) => {
      const route = computeSemanticEgressForRoom(version, room.id);

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

      const graph = buildRoomGraph(version);
      const legacyRoute = findRoomPath(graph, room.id, version.rooms.find((item) => item.type === "stair" || item.type === "elevator")?.id ?? "");

      if (legacyRoute && legacyRoute.length >= 2) {
        egressPaths.push({
          id: `egress-${room.id}`,
          points: legacyRoute,
          distance: pathLength(legacyRoute)
        });
        egressDistances.push({
          roomId: room.id,
          center: centroid(room),
          distance: pathLength(legacyRoute)
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
  options: ComputeAnalysisOptions | string = {}
): AnalysisResult {
  const resolvedOptions: ComputeAnalysisOptions =
    typeof options === "string" ? { levelId: options } : options;
  const levelId = resolvedOptions.levelId;
  const pack = resolvedOptions.typologyPack ?? resolveTypologyPack(resolvedOptions.projectType);
  const layers = canonicalizeAnalysisLayers(requestedLayers);

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
  const needsGraph =
    wantsAnyFlowLayer(layers) ||
    layerRequested(layers, "egress_path") ||
    layerRequested(layers, "egress_distance");
  const graph = needsGraph ? buildRoomGraph(scopedVersion) : undefined;

  const daylightCandidates = scopedVersion.rooms.filter(
    (room) => room.needsDaylight || hasWindowOpening(scopedVersion, room)
  );
  const daylightSamples =
    layerRequested(layers, "daylight") && daylightCandidates.length > 0
      ? computeDaylightSamples(scopedVersion, daylightCandidates)
      : [];

  const flowPaths =
    graph && wantsAnyFlowLayer(layers) ? computeFlowPaths(scopedVersion, graph, pack) : undefined;

  const egress =
    layerRequested(layers, "egress_path") || layerRequested(layers, "egress_distance")
      ? computeEgress(scopedVersion)
      : { egressPaths: [], egressDistances: [] };

  const publicRoom = roomByTypes(scopedVersion, ["lobby"]) ?? scopedVersion.rooms[0];
  const corridor = roomByTypes(scopedVersion, ["corridor"]);
  const destinationRoom =
    roomByTypes(scopedVersion, ["consultation", "office", "living_room", "other"]) ?? corridor;

  const primaryFlow = layerRequested(layers, "primary_flow") ? flowPaths?.primaryFlow : undefined;
  const staffFlow = layerRequested(layers, "staff_flow") ? flowPaths?.staffFlow : undefined;
  const serviceFlow = layerRequested(layers, "service_flow") ? flowPaths?.serviceFlow : undefined;

  return {
    versionId: version.id,
    requestedLayers: layers,
    rooms: roomOverlays,
    daylightRooms: daylightSamples.map((sample) => {
      const room = daylightCandidates.find((item) => item.id === sample.roomId);

      return {
        ...(room ? roomOverlay(room) : roomOverlays.find((item) => item.roomId === sample.roomId)!),
        radius: sample.radius,
        penetration: sample.penetration
      };
    }),
    ventilationVectors: layerRequested(layers, "ventilation")
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
      layerRequested(layers, "sightline") && publicRoom
        ? computeSightlineCone(scopedVersion, publicRoom, corridor ?? destinationRoom)
        : undefined,
    primaryFlow,
    staffFlow,
    serviceFlow,
    patientFlow: primaryFlow,
    cleanDirtyFlow: serviceFlow,
    egressPaths: layerRequested(layers, "egress_path") ? egress.egressPaths : [],
    egressDistances: layerRequested(layers, "egress_distance") ? egress.egressDistances : [],
    corePoint,
    coreLines: layerRequested(layers, "core_efficiency")
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
  requestedLayers: AnalysisLayerId[],
  projectType?: string
): BuildingAnalysisSummary {
  const levelSummaries = version.levels.map((level) => {
    const analysis = computeAnalysis(version, requestedLayers, { levelId: level.id, projectType });
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
