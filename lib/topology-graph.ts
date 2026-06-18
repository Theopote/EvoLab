import type { PlanTopologyVersion } from "@/lib/schemas/plan-version-schema";
import type { TopologyGraph } from "@/lib/project-types";

export function topologyGraphFromTopology(topology: PlanTopologyVersion): TopologyGraph {
  return {
    id: topology.id,
    label: topology.label,
    strategy: topology.strategy,
    topology: topology.topology,
    rooms: topology.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      zone: room.zone,
      targetAreaSqm: room.targetAreaSqm,
      ceilingHeight: room.ceilingHeight,
      needsDaylight: room.needsDaylight,
      needsPlumbing: room.needsPlumbing,
      preferredEdge: room.preferredEdge,
      adjacencyIds: room.adjacencyIds
    })),
    edges: topology.edges
  };
}
