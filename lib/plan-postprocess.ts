import { normalizePlanVersion, type PlanVersionDraft } from "@/lib/architecture-model";
import type { PlanVersion, Point, Room } from "@/lib/project-types";
import { calculateScores } from "@/lib/plan-scoring";
import { polygonArea, validatePlanVersion } from "@/lib/plan-validation";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function repairPoint(point: Point, width: number, height: number): Point {
  return [clamp(point[0], 0, width), clamp(point[1], 0, height)];
}

function repairRoom(room: Room, width: number, height: number) {
  const polygon = room.polygon.map((point) => repairPoint(point, width, height));
  const actualArea = polygonArea(polygon);
  const areaDeviation = Math.abs(actualArea - room.areaSqm) / Math.max(1, room.areaSqm);
  const repairs: string[] = [];

  if (areaDeviation > 0.25) {
    repairs.push(`${room.name} areaSqm adjusted to polygon area.`);
  }

  return {
    room: {
      ...room,
      polygon,
      areaSqm: areaDeviation > 0.25 ? Math.round(actualArea) : room.areaSqm,
      ceilingHeight: Math.max(2.4, room.ceilingHeight || 3),
      doors: room.doors ?? [],
      windows: room.windows ?? [],
      adjacents: room.adjacents ?? []
    },
    repairs
  };
}

function repairMissingCore(version: PlanVersion) {
  if (version.rooms.some((room) => room.type === "stair" || room.type === "elevator")) {
    return { version, repairs: [] as string[] };
  }

  const width = Math.max(4, Math.min(8, version.overallBounds.width * 0.12));
  const height = Math.max(5, Math.min(9, version.overallBounds.height * 0.18));
  const x = Math.max(0, version.overallBounds.width - width - 2);
  const y = Math.max(0, version.overallBounds.height - height - 2);
  const core: Room = {
    id: "auto-core-01",
    name: "Auto Core",
    type: "elevator",
    zone: "circulation",
    polygon: [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ],
    areaSqm: Math.round(width * height),
    ceilingHeight: 3.3,
    doors: [{ wall: "west", position: 0.5, width: 1.2 }],
    windows: [],
    adjacents: version.rooms.filter((room) => room.type === "corridor").map((room) => room.id)
  };

  return {
    version: {
      ...version,
      rooms: [...version.rooms, core]
    },
    repairs: ["Inserted a fallback stair/elevator core because the AI output had no vertical core."]
  };
}

export function repairPlanVersion(version: PlanVersion) {
  const repairs: string[] = [];
  const repairedRooms = version.rooms.map((room) => {
    const result = repairRoom(room, version.overallBounds.width, version.overallBounds.height);
    repairs.push(...result.repairs);
    return result.room;
  });
  const withRooms = {
    ...version,
    rooms: repairedRooms
  };
  const coreRepair = repairMissingCore(withRooms);

  return {
    version: coreRepair.version,
    repairs: [...repairs, ...coreRepair.repairs]
  };
}

export function postProcessPlanVersion(draft: PlanVersionDraft): PlanVersion {
  const firstPass = normalizePlanVersion(draft);
  const initialValidation = validatePlanVersion(firstPass);
  const repaired = repairPlanVersion(firstPass);
  const normalized = normalizePlanVersion(repaired.version);
  const finalValidation = validatePlanVersion(normalized);
  const allIssues = [...initialValidation.issues, ...finalValidation.issues];
  const scores = calculateScores(normalized, finalValidation.issues);
  const validationWarnings = Array.from(new Set(allIssues.map((issue) => issue.message)));
  const repairs = Array.from(new Set(repaired.repairs));

  return {
    ...normalized,
    scores,
    metadata: {
      ...normalized.metadata,
      validationWarnings,
      repairs
    }
  };
}

export function postProcessPlanVersions(drafts: PlanVersionDraft[]) {
  return drafts.map((draft) => postProcessPlanVersion(draft));
}
