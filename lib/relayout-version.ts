import type { PlanTopologyVersion } from "@/lib/schemas/plan-version-schema";
import { expandPlanVersionToFloors } from "@/lib/multi-floor";
import { topologyToPlanVersion, type TopologyLayoutOptions } from "@/lib/topology-geometry";
import { topologyGraphFromTopology } from "@/lib/topology-graph";
import type { PlanVersion, TopologyGraphEdge } from "@/lib/project-types";

const DEFAULT_TOPOLOGY_NARRATIVE = {
  circulation: "Corridor spine connects public and clinical zones.",
  core: "Vertical core grouped with service edge.",
  daylight: "Daylit rooms placed on perimeter bands.",
  plumbing: "Wet rooms clustered near shafts."
};

function buildEdgesFromAdjacents(rooms: PlanVersion["rooms"]): TopologyGraphEdge[] {
  const edges: TopologyGraphEdge[] = [];
  const seen = new Set<string>();

  rooms.forEach((room) => {
    (room.adjacents ?? []).forEach((adjacentId) => {
      const key = [room.id, adjacentId].sort().join("::");
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      edges.push({ from: room.id, to: adjacentId, relationship: "direct" });
    });
  });

  return edges;
}

export function extractTopologyFromVersion(version: PlanVersion): PlanTopologyVersion | null {
  if (version.metadata?.topologyGraph) {
    const graph = version.metadata.topologyGraph;
    return {
      id: graph.id,
      label: graph.label,
      strategy: graph.strategy,
      topology: graph.topology,
      rooms: graph.rooms.map((room) => ({
        id: room.id,
        name: room.name,
        type: room.type,
        zone: room.zone,
        targetAreaSqm: room.targetAreaSqm,
        ceilingHeight: room.ceilingHeight,
        needsDaylight: room.needsDaylight ?? false,
        needsPlumbing: room.needsPlumbing ?? false,
        preferredEdge: room.preferredEdge,
        adjacencyIds: room.adjacencyIds ?? []
      })),
      edges: graph.edges
    };
  }

  if (version.rooms.length < 4) {
    return null;
  }

  const narrative = version.metadata?.topology;
  return {
    id: version.id,
    label: version.label,
    strategy: version.metadata?.strategy ?? "Reconstructed room program",
    topology: {
      circulation: narrative?.circulation ?? DEFAULT_TOPOLOGY_NARRATIVE.circulation,
      core: narrative?.core ?? DEFAULT_TOPOLOGY_NARRATIVE.core,
      daylight: narrative?.daylight ?? DEFAULT_TOPOLOGY_NARRATIVE.daylight,
      plumbing: narrative?.plumbing ?? DEFAULT_TOPOLOGY_NARRATIVE.plumbing
    },
    rooms: version.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      zone: room.zone,
      targetAreaSqm: Math.max(6, room.areaSqm),
      ceilingHeight: room.ceilingHeight,
      needsDaylight: room.needsDaylight ?? false,
      needsPlumbing: room.needsPlumbing ?? false,
      preferredEdge: room.orientation as PlanTopologyVersion["rooms"][number]["preferredEdge"],
      adjacencyIds: room.adjacents ?? []
    })),
    edges: buildEdgesFromAdjacents(version.rooms)
  };
}

export interface RelayoutPlanVersionOptions extends TopologyLayoutOptions {
  preserveVersionMeta?: boolean;
  topologyOverride?: PlanTopologyVersion;
}

export function relayoutPlanVersion(version: PlanVersion, options: RelayoutPlanVersionOptions): PlanVersion {
  const topology = options.topologyOverride ?? extractTopologyFromVersion(version);
  if (!topology) {
    throw new Error("Cannot relayout: active version has no stored or reconstructable topology graph.");
  }

  const layoutOptions: TopologyLayoutOptions = {
    ...options,
    sourceWindowsByRoomId:
      options.lockExteriorWindows && !options.sourceWindowsByRoomId
        ? Object.fromEntries(
            version.rooms
              .filter((room) => room.windows?.length)
              .map((room) => [room.id, room.windows ?? []])
          )
        : options.sourceWindowsByRoomId
  };

  const relaid = topologyToPlanVersion(topology, layoutOptions, 0);
  const topologyGraph = topologyGraphFromTopology(topology);
  const floorCount = version.metadata?.floorCount ?? version.levels.length;

  const relaidVersion = {
    ...relaid,
    id: version.id,
    label: version.label,
    createdAt: version.createdAt,
    parentVersionId: version.parentVersionId,
    metadata: {
      ...(options.preserveVersionMeta === false ? {} : version.metadata),
      ...relaid.metadata,
      strategy: topology.strategy,
      topology: topology.topology,
      topologyGraph,
      relayoutedAt: new Date().toISOString(),
      pipelinePhases: version.metadata?.pipelinePhases,
      zoningApplied: version.metadata?.zoningApplied,
      envelopeCompliant: version.metadata?.envelopeCompliant,
      floorCount: floorCount > 1 ? floorCount : version.metadata?.floorCount
    },
    scores: relaid.scores,
    mep: undefined
  };

  return floorCount > 1 ? expandPlanVersionToFloors(relaidVersion, floorCount) : relaidVersion;
}
