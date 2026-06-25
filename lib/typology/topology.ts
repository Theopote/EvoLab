import type { PlanTopologyVersion, TopologyEdge, TopologyRoom } from "@/lib/schemas/plan-version-schema";
import type { PackAdjacencyRule } from "@/lib/typology/types";
import type { RoomType } from "@/lib/project-types";
import type { TopologyRoomTemplate, TopologyStrategyTemplate, TypologyPack } from "@/lib/typology/types";

function uniqueEdges(edges: TopologyEdge[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = [edge.from, edge.to].sort().join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function isWetRoomType(pack: TypologyPack, type: RoomType) {
  return pack.topology.wetRoomTypes.includes(type);
}

export function buildTopologyRoomsFromStrategy(
  pack: TypologyPack,
  strategy: TopologyStrategyTemplate,
  grossAreaSqm: number
): TopologyRoom[] {
  void strategy;
  const templates = pack.topology.roomTemplates;
  const totalShare = templates.reduce((sum, template) => sum + template.areaShare, 0) || 1;

  return templates.map((template) => topologyRoomFromTemplate(template, grossAreaSqm, totalShare));
}

function topologyRoomFromTemplate(template: TopologyRoomTemplate, grossAreaSqm: number, totalShare: number) {
  const normalizedShare = template.areaShare / totalShare;
  const targetAreaSqm = Math.max(12, Math.round(grossAreaSqm * normalizedShare));

  return {
    id: template.id,
    name: template.name,
    type: template.roomType,
    zone: template.zone,
    targetAreaSqm,
    ceilingHeight: template.roomType === "lobby" ? 5.2 : template.roomType === "equipment_room" ? 3.6 : 3.3,
    needsDaylight: template.needsDaylight ?? (template.zone !== "service" && template.roomType !== "corridor"),
    needsPlumbing: template.needsPlumbing ?? isPlumbingRoomType(template.roomType),
    preferredEdge: template.preferredEdge ?? defaultPreferredEdge(template),
    adjacencyIds: template.adjacencyIds ?? []
  };
}

function isPlumbingRoomType(type: RoomType) {
  return ["bathroom", "kitchen", "consultation", "equipment_room", "shaft"].includes(type);
}

function defaultPreferredEdge(template: TopologyRoomTemplate) {
  if (template.zone === "service" || template.roomType === "corridor") {
    return "interior" as const;
  }
  if (template.zone === "public") {
    return "south" as const;
  }
  return "south" as const;
}

export function buildTopologyEdgesFromPack(pack: TypologyPack, rooms: TopologyRoom[]): TopologyEdge[] {
  const edges: TopologyEdge[] = [];
  const roomIds = new Set(rooms.map((room) => room.id));

  const addEdge = (from: string, to: string, relationship: TopologyEdge["relationship"] = "direct") => {
    if (!roomIds.has(from) || !roomIds.has(to) || from === to) {
      return;
    }
    edges.push({ from, to, relationship });
  };

  for (const room of rooms) {
    for (const adjacencyId of room.adjacencyIds ?? []) {
      addEdge(room.id, adjacencyId);
    }
  }

  for (const rule of pack.adjacencyRules) {
    applyAdjacencyRule(rooms, rule, addEdge);
  }

  return uniqueEdges(edges);
}

function applyAdjacencyRule(
  rooms: TopologyRoom[],
  rule: PackAdjacencyRule,
  addEdge: (from: string, to: string, relationship?: TopologyEdge["relationship"]) => void
) {
  const relationship = rule.relationship === "must" ? "direct" : rule.relationship === "prefer" ? "near" : "separated";
  const fromRooms = rooms.filter((room) => rule.fromRoomTypes.includes(room.type));
  const toRooms = rooms.filter((room) => rule.toRoomTypes.includes(room.type));

  for (const fromRoom of fromRooms) {
    for (const toRoom of toRooms) {
      addEdge(fromRoom.id, toRoom.id, relationship);
    }
  }
}

export function buildPlanTopologyVersionsFromPack(pack: TypologyPack, grossAreaSqm = 1200): PlanTopologyVersion[] {
  return pack.topology.strategies.map((strategy, index) => {
    const rooms = buildTopologyRoomsFromStrategy(pack, strategy, grossAreaSqm);
    const edges = buildTopologyEdgesFromPack(pack, rooms);

    return {
      id: `${pack.id}-topology-${index + 1}`,
      label: `Scheme ${String.fromCharCode(65 + index)} / ${strategy.label}`,
      strategy: strategy.label,
      topology: {
        circulation: strategy.circulation,
        core: strategy.core,
        daylight: strategy.daylight,
        plumbing: strategy.plumbing
      },
      rooms,
      edges
    };
  });
}

export function getTopologyPromptContext(pack: TypologyPack) {
  const strategies = pack.topology.strategies
    .map((strategy) => `- ${strategy.label}: ${strategy.circulation}`)
    .join("\n");
  const rooms = pack.topology.roomTemplates
    .map((room) => `- ${room.name} (${room.roomType}, ${room.zone}): ~${Math.round(room.areaShare * 100)}% of floor area`)
    .join("\n");
  const adjacency = pack.adjacencyRules
    .map((rule) => `${rule.fromRoomTypes.join("/")} -> ${rule.toRoomTypes.join("/")}: ${rule.relationship}`)
    .join("\n");

  return [
    `Typology: ${pack.label} (${pack.id})`,
    `Allowed room types: ${pack.roomTypes.join(", ")}`,
    pack.topology.promptGuidance,
    "",
    "Preferred topology strategies:",
    strategies,
    "",
    "Room program template:",
    rooms,
    "",
    "Adjacency rules:",
    adjacency
  ].join("\n");
}

export function getGeometryPromptContext(pack: TypologyPack) {
  const wetTypes = pack.topology.wetRoomTypes.join(", ");
  const layoutKinds = [...new Set(pack.topology.strategies.map((strategy) => strategy.layoutKind))].join(", ");

  return [
    `Geometry layout for ${pack.label} (${pack.id}):`,
    `- Allowed layout kinds: ${layoutKinds}.`,
    `- Wet room types: ${wetTypes}. Cluster these near shafts; keep needsPlumbing rooms within 12m of a shaft.`,
    `- Honor preferredEdge from topology when placing rooms on the outline perimeter.`,
    `- Match targetAreaSqm from topology; room.areaSqm should stay within 20% of polygon area.`,
    `- Corridor connectivity must follow topology edges with relationship "direct".`,
    `- Prefer orthogonal room polygons that preserve adjacency without overlap.`,
    pack.topology.promptGuidance
  ].join("\n");
}
