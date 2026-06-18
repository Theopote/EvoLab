import { optimizeLayoutRects } from "@/lib/layout-optimizer";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import { topologyGraphFromTopology } from "@/lib/topology-graph";
import type { PlanTopologyVersion, TopologyRoom } from "@/lib/schemas/plan-version-schema";
import type { Opening, PlanVersion, Point, Room, RoomType } from "@/lib/project-types";

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getBounds(points: Point[]): Bounds {
  const raw = points.reduce(
    (acc, [x, y]) => ({
      minX: Math.min(acc.minX, x),
      minY: Math.min(acc.minY, y),
      maxX: Math.max(acc.maxX, x),
      maxY: Math.max(acc.maxY, y)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  return {
    ...raw,
    width: Math.max(1, raw.maxX - raw.minX),
    height: Math.max(1, raw.maxY - raw.minY)
  };
}

function localizeOutline(points: Point[], bounds: Bounds): Point[] {
  return points.map(([x, y]) => [x - bounds.minX, y - bounds.minY]);
}

function rectPolygon(rect: Rect): Point[] {
  return [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y + rect.height]
  ];
}

function roomAreaWeight(room: TopologyRoom) {
  return Math.max(6, room.targetAreaSqm);
}

function splitRect(rooms: TopologyRoom[], rect: Rect, axis: "x" | "y") {
  const total = rooms.reduce((sum, room) => sum + roomAreaWeight(room), 0);
  let cursor = axis === "x" ? rect.x : rect.y;

  return rooms.map((room, index) => {
    const isLast = index === rooms.length - 1;
    const share = total > 0 ? roomAreaWeight(room) / total : 1 / Math.max(1, rooms.length);
    const length = isLast
      ? axis === "x"
        ? rect.x + rect.width - cursor
        : rect.y + rect.height - cursor
      : axis === "x"
        ? rect.width * share
        : rect.height * share;
    const next =
      axis === "x"
        ? { x: cursor, y: rect.y, width: Math.max(1, length), height: rect.height }
        : { x: rect.x, y: cursor, width: rect.width, height: Math.max(1, length) };

    cursor += length;
    return [room.id, next] as const;
  });
}

function uniqueRooms(rooms: TopologyRoom[]) {
  const seen = new Set<string>();
  return rooms.filter((room) => {
    if (seen.has(room.id)) {
      return false;
    }

    seen.add(room.id);
    return true;
  });
}

const DEFAULT_WET_ROOM_TYPES: RoomType[] = ["bathroom", "kitchen", "consultation", "equipment_room", "shaft"];

function fallbackRoom(
  id: string,
  name: string,
  type: Room["type"],
  zone: Room["zone"],
  targetAreaSqm: number,
  wetRoomTypes: RoomType[] = DEFAULT_WET_ROOM_TYPES
): TopologyRoom {
  return {
    id,
    name,
    type,
    zone,
    targetAreaSqm,
    ceilingHeight: type === "lobby" ? 5.2 : type === "equipment_room" ? 3.6 : 3.3,
    needsDaylight: zone !== "service" && type !== "corridor",
    needsPlumbing: wetRoomTypes.includes(type),
    preferredEdge: zone === "service" || type === "corridor" ? "interior" : "south",
    adjacencyIds: []
  };
}

function completeTopologyRooms(topology: PlanTopologyVersion, bounds: Bounds, wetRoomTypes: RoomType[] = DEFAULT_WET_ROOM_TYPES) {
  const rooms = uniqueRooms(topology.rooms);
  const hasCorridor = rooms.some((room) => room.type === "corridor");
  const hasCore = rooms.some((room) => room.type === "stair" || room.type === "elevator");
  const hasShaft = rooms.some((room) => room.type === "shaft");

  if (!hasCorridor) {
    rooms.push(fallbackRoom("corridor-01", "Main Corridor", "corridor", "circulation", bounds.width * bounds.height * 0.12, wetRoomTypes));
  }

  if (!hasCore) {
    rooms.push(fallbackRoom("core-01", "Vertical Core", "elevator", "circulation", bounds.width * bounds.height * 0.06, wetRoomTypes));
  }

  if (!hasShaft && rooms.some((room) => room.needsPlumbing || wetRoomTypes.includes(room.type))) {
    rooms.push(fallbackRoom("shaft-01", "Service Shaft", "shaft", "service", bounds.width * bounds.height * 0.025, wetRoomTypes));
  }

  return rooms;
}

function classifyRooms(rooms: TopologyRoom[]) {
  const corridors = rooms.filter((room) => room.type === "corridor");
  const service = rooms.filter((room) =>
    ["shaft", "equipment_room", "stair", "elevator"].includes(room.type) || room.zone === "service"
  );
  const serviceIds = new Set([...corridors, ...service].map((room) => room.id));
  const south = rooms.filter((room) => !serviceIds.has(room.id) && (room.preferredEdge === "south" || room.zone === "public"));
  const north = rooms.filter((room) => !serviceIds.has(room.id) && !south.some((southRoom) => southRoom.id === room.id));

  return { corridors, service, south, north };
}

function layoutHorizontal(rooms: TopologyRoom[], bounds: Bounds) {
  const { corridors, service, south, north } = classifyRooms(rooms);
  const rects = new Map<string, Rect>();
  const width = bounds.width;
  const height = bounds.height;
  const serviceW = service.length ? clamp(width * 0.18, 7, width * 0.28) : 0;
  const usableW = Math.max(8, width - serviceW);
  const corridorH = clamp(height * 0.13, 4, 7);
  const corridorY = clamp(height * 0.42, height * 0.28, height - corridorH - height * 0.2);
  const southH = Math.max(4, corridorY);
  const northY = corridorY + corridorH;
  const northH = Math.max(4, height - northY);

  splitRect(south.length ? south : north.slice(0, 1), { x: 0, y: 0, width: usableW, height: southH }, "x").forEach(([id, rect]) =>
    rects.set(id, rect)
  );
  splitRect(north, { x: 0, y: northY, width: usableW, height: northH }, "x").forEach(([id, rect]) => rects.set(id, rect));
  splitRect(corridors, { x: 0, y: corridorY, width: usableW, height: corridorH }, "x").forEach(([id, rect]) =>
    rects.set(id, rect)
  );
  splitRect(service, { x: usableW, y: 0, width: serviceW || width * 0.16, height }, "y").forEach(([id, rect]) =>
    rects.set(id, rect)
  );

  return rects;
}

function layoutVertical(rooms: TopologyRoom[], bounds: Bounds) {
  const { corridors, service, south, north } = classifyRooms(rooms);
  const rects = new Map<string, Rect>();
  const width = bounds.width;
  const height = bounds.height;
  const serviceH = service.length ? clamp(height * 0.2, 7, height * 0.3) : 0;
  const usableH = Math.max(8, height - serviceH);
  const corridorW = clamp(width * 0.14, 4, 7);
  const corridorX = clamp(width * 0.42, width * 0.25, width - corridorW - width * 0.2);
  const westW = Math.max(4, corridorX);
  const eastX = corridorX + corridorW;
  const eastW = Math.max(4, width - eastX);

  splitRect(south.length ? south : north.slice(0, 1), { x: 0, y: 0, width: westW, height: usableH }, "y").forEach(([id, rect]) =>
    rects.set(id, rect)
  );
  splitRect(north, { x: eastX, y: 0, width: eastW, height: usableH }, "y").forEach(([id, rect]) => rects.set(id, rect));
  splitRect(corridors, { x: corridorX, y: 0, width: corridorW, height: usableH }, "y").forEach(([id, rect]) =>
    rects.set(id, rect)
  );
  splitRect(service, { x: 0, y: usableH, width, height: serviceH || height * 0.16 }, "x").forEach(([id, rect]) =>
    rects.set(id, rect)
  );

  return rects;
}

function openingForRoom(room: TopologyRoom, rect: Rect, bounds: Bounds, kind: "door" | "window"): Opening | undefined {
  if (kind === "door") {
    if (room.type === "corridor" || room.type === "shaft") {
      return undefined;
    }

    return { wall: rect.x > bounds.width / 2 ? "west" : "east", position: 0.5, width: room.type === "lobby" ? 3.2 : 1.2 };
  }

  if (!room.needsDaylight) {
    return undefined;
  }

  const touchesSouth = rect.y <= 0.01;
  const touchesNorth = rect.y + rect.height >= bounds.height - 0.01;
  const touchesWest = rect.x <= 0.01;
  const touchesEast = rect.x + rect.width >= bounds.width - 0.01;
  const wall = touchesSouth
    ? "south"
    : touchesNorth
      ? "north"
      : touchesWest
        ? "west"
        : touchesEast
          ? "east"
          : undefined;

  return wall ? { wall, position: 0.5, width: clamp(Math.sqrt(room.targetAreaSqm), 2.4, 10) } : undefined;
}

function buildAdjacencyIds(room: TopologyRoom, topology: PlanTopologyVersion, corridorIds: string[]) {
  const edgeAdjacencies = topology.edges
    .filter((edge) => edge.relationship !== "separated" && (edge.from === room.id || edge.to === room.id))
    .map((edge) => (edge.from === room.id ? edge.to : edge.from));

  return Array.from(new Set([...(room.adjacencyIds ?? []), ...edgeAdjacencies, ...corridorIds.filter((id) => id !== room.id)]));
}

export interface TopologyLayoutOptions {
  layoutOutline?: Point[];
  siteOutline?: Point[];
  wetRoomTypes?: RoomType[];
}

function resolveTopologyLayout(outlineOrOptions?: Point[] | TopologyLayoutOptions) {
  const options: TopologyLayoutOptions = Array.isArray(outlineOrOptions)
    ? { layoutOutline: outlineOrOptions, siteOutline: outlineOrOptions }
    : outlineOrOptions ?? {};

  const defaultOutline: Point[] = [
    [0, 0],
    [72, 0],
    [72, 42],
    [0, 42]
  ];
  const sourceSite =
    options.siteOutline && options.siteOutline.length >= 3
      ? options.siteOutline
      : options.layoutOutline && options.layoutOutline.length >= 3
        ? options.layoutOutline
        : defaultOutline;
  const sourceLayout =
    options.layoutOutline && options.layoutOutline.length >= 3 ? options.layoutOutline : sourceSite;
  const originBounds = getBounds(sourceSite);
  const localizedSite = localizeOutline(sourceSite, originBounds);
  const localizedLayout = localizeOutline(sourceLayout, originBounds);
  const bounds = getBounds(localizedLayout);

  return {
    localizedSite,
    bounds
  };
}

export function topologyToPlanVersion(
  topology: PlanTopologyVersion,
  outlineOrOptions?: Point[] | TopologyLayoutOptions,
  index = 0
): PlanVersion {
  const { localizedSite, bounds } = resolveTopologyLayout(outlineOrOptions);
  const wetRoomTypes =
    !Array.isArray(outlineOrOptions) && outlineOrOptions?.wetRoomTypes?.length
      ? outlineOrOptions.wetRoomTypes
      : DEFAULT_WET_ROOM_TYPES;
  const rooms = completeTopologyRooms(topology, bounds, wetRoomTypes);
  const rects = bounds.width >= bounds.height ? layoutHorizontal(rooms, bounds) : layoutVertical(rooms, bounds);
  optimizeLayoutRects(rects, topology, bounds);
  const corridorIds = rooms.filter((room) => room.type === "corridor").map((room) => room.id);
  const planRooms: Room[] = rooms.map((room) => {
    const rect = rects.get(room.id) ?? { x: 0, y: 0, width: bounds.width, height: bounds.height };
    const door = openingForRoom(room, rect, bounds, "door");
    const window = openingForRoom(room, rect, bounds, "window");

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      zone: room.zone,
      polygon: rectPolygon(rect),
      areaSqm: Math.round(rect.width * rect.height),
      ceilingHeight: room.ceilingHeight ?? (room.type === "lobby" ? 5.2 : room.type === "equipment_room" ? 3.6 : 3.3),
      orientation: room.preferredEdge,
      doors: door ? [door] : [],
      windows: window ? [window] : [],
      needsDaylight: room.needsDaylight,
      needsPlumbing: room.needsPlumbing,
      adjacents: buildAdjacencyIds(room, topology, corridorIds)
    };
  });

  return postProcessPlanVersion({
    id: topology.id || `topology-plan-${index + 1}`,
    label: topology.label || `Topology Scheme ${index + 1}`,
    createdAt: new Date().toISOString(),
    metadata: {
      strategy: topology.strategy,
      topology: topology.topology,
      topologyGraph: topologyGraphFromTopology(topology)
    },
    outline: localizedSite,
    overallBounds: {
      width: bounds.width,
      height: bounds.height
    },
    rooms: planRooms
  });
}

export function topologiesToPlanVersions(
  topologies: PlanTopologyVersion[],
  outlineOrOptions?: Point[] | TopologyLayoutOptions
) {
  return topologies.map((topology, index) => topologyToPlanVersion(topology, outlineOrOptions, index));
}
