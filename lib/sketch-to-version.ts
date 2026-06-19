import { normalizePlanVersion } from "@/lib/architecture-model";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";
import type { FunctionZone, PlanVersion, Point, Room, RoomType } from "@/lib/project-types";
import { polygonArea } from "@/lib/plan-validation";
import type { RecognizedSketchRoom } from "@/lib/schemas/sketch-interpretation-schema";

function inferRoomType(name: string): RoomType {
  const normalized = name.toLowerCase();

  if (/corridor|hall|走道|走廊/.test(normalized)) {
    return "corridor";
  }

  if (/lobby|门厅|大堂/.test(normalized)) {
    return "lobby";
  }

  if (/bath|wc|卫|厕/.test(normalized)) {
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

  return "other";
}

function inferRoomZone(type: RoomType): FunctionZone {
  if (type === "corridor" || type === "stair" || type === "elevator") {
    return "circulation";
  }

  if (type === "lobby") {
    return "public";
  }

  if (type === "bathroom" || type === "kitchen") {
    return "service";
  }

  return "private";
}

function isRectangular(polygon: Point[]) {
  if (polygon.length !== 4) {
    return false;
  }

  const angles: number[] = [];

  for (let index = 0; index < polygon.length; index += 1) {
    const prev = polygon[(index + polygon.length - 1) % polygon.length];
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const v1: Point = [current[0] - prev[0], current[1] - prev[1]];
    const v2: Point = [next[0] - current[0], next[1] - current[1]];
    const dot = v1[0] * v2[0] + v1[1] * v2[1];
    const mag = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);

    if (mag < Number.EPSILON) {
      return false;
    }

    const degrees = Math.abs((Math.acos(dot / mag) * 180) / Math.PI - 90);
    angles.push(degrees);
  }

  return angles.every((angle) => angle <= 10);
}

export function buildRecognizedRoomsFromLoops(
  loops: Array<{ polygon: Point[]; index: number }>
): RecognizedSketchRoom[] {
  return loops.map((loop, index) => {
    const areaSqm = polygonArea(loop.polygon);
    const rectangular = isRectangular(loop.polygon);
    const confidence = areaSqm >= 4 && rectangular ? "high" : "needs_review";

    return {
      room: {
        id: `sketch-room-${loop.index + 1}`,
        name: `Room ${index + 1}`,
        type: "other" as const,
        zone: "private" as const,
        polygon: loop.polygon,
        areaSqm: Math.max(4, Math.round(areaSqm)),
        ceilingHeight: 3,
        doors: [],
        windows: [],
        adjacents: []
      },
      confidence,
      reasons: confidence === "needs_review" ? ["Geometry-only fallback naming."] : undefined
    };
  });
}

function toRoom(entry: RecognizedSketchRoom): Room {
  const type = entry.room.type ?? inferRoomType(entry.room.name);
  const polygon = entry.room.polygon as Point[];

  return {
    id: entry.room.id,
    name: entry.room.name,
    type,
    zone: entry.room.zone ?? inferRoomZone(type),
    polygon,
    areaSqm: entry.room.areaSqm ?? Math.max(4, Math.round(polygonArea(polygon))),
    ceilingHeight: entry.room.ceilingHeight ?? 3,
    doors: entry.room.doors ?? [],
    windows: entry.room.windows ?? [],
    adjacents: entry.room.adjacents ?? []
  };
}

export function mergeSketchRoomsIntoVersion(
  currentVersion: PlanVersion,
  recognizedRooms: RecognizedSketchRoom[],
  options?: { append?: boolean }
): PlanVersion {
  const append = options?.append ?? true;
  const mappedRooms = recognizedRooms.map(toRoom);
  const rooms = append ? [...currentVersion.rooms, ...mappedRooms] : mappedRooms;
  const draft = normalizePlanVersion({
    ...currentVersion,
    id: `${currentVersion.id}-sketch-${Date.now()}`,
    label: `${currentVersion.label} / Sketch`,
    createdAt: new Date().toISOString(),
    parentVersionId: currentVersion.id,
    rooms
  });

  return postProcessPlanVersion(draft);
}
