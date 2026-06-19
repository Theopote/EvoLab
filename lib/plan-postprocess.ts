import { normalizePlanVersion, type PlanVersionDraft } from "@/lib/architecture-model";
import type { CodeContext, ProgramModel } from "@/lib/building-domain";
import { enforceOpeningConstraintsOnVersion } from "@/lib/opening-constraints";
import { applyLevelRoomsToVersion, resolveLevelRooms } from "@/lib/level-rooms";
import type { PlanVersion, Point, Room } from "@/lib/project-types";
import { calculateScores } from "@/lib/plan-scoring";
import { polygonArea, validatePlanVersion, buildFloorValidationSummary } from "@/lib/plan-validation";

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

function createAutoCore(version: PlanVersion, levelId: string, rooms: Room[]): Room {
  const width = Math.max(4, Math.min(8, version.overallBounds.width * 0.12));
  const height = Math.max(5, Math.min(9, version.overallBounds.height * 0.18));
  const x = Math.max(0, version.overallBounds.width - width - 2);
  const y = Math.max(0, version.overallBounds.height - height - 2);

  return {
    id: `auto-core-${levelId}`,
    name: "Auto Core",
    type: "elevator",
    zone: "circulation",
    levelId,
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
    adjacents: rooms.filter((room) => room.type === "corridor").map((room) => room.id)
  };
}

function repairMissingCore(version: PlanVersion) {
  const repairs: string[] = [];
  let next = version;

  next.levels.forEach((level) => {
    const rooms = resolveLevelRooms(level, next.standardFloorGroups);
    const hasCore = rooms.some((room) => room.type === "stair" || room.type === "elevator");

    if (hasCore) {
      return;
    }

    const core = createAutoCore(next, level.id, rooms);
    const updated = applyLevelRoomsToVersion(next, level.id, [...rooms, core]);

    if (updated) {
      next = updated;
      repairs.push(
        next.levels.length > 1
          ? `Inserted a fallback stair/elevator core on ${level.name}.`
          : "Inserted a fallback stair/elevator core because the AI output had no vertical core."
      );
    }
  });

  return { version: next, repairs };
}

export function repairPlanVersion(version: PlanVersion) {
  const repairs: string[] = [];
  let next = version;

  next.levels.forEach((level) => {
    const rooms = resolveLevelRooms(level, next.standardFloorGroups);
    const repairedRooms = rooms.map((room) => {
      const result = repairRoom(room, next.overallBounds.width, next.overallBounds.height);
      repairs.push(...result.repairs);
      return result.room;
    });
    const updated = applyLevelRoomsToVersion(next, level.id, repairedRooms);

    if (updated) {
      next = updated;
    }
  });

  const coreRepair = repairMissingCore(next);

  return {
    version: coreRepair.version,
    repairs: [...repairs, ...coreRepair.repairs]
  };
}

export interface PostProcessOptions {
  codeContext?: CodeContext;
  program?: ProgramModel;
  projectType?: string;
  orientationDeg?: number;
}

export function postProcessPlanVersion(draft: PlanVersionDraft, options: PostProcessOptions = {}): PlanVersion {
  const firstPass = normalizePlanVersion(draft);
  const openingEnforced = enforceOpeningConstraintsOnVersion(firstPass);
  const initialValidation = validatePlanVersion(openingEnforced.version, {
    codeContext: options.codeContext,
    projectType: options.projectType
  });
  const repaired = repairPlanVersion(openingEnforced.version);
  const normalized = normalizePlanVersion(repaired.version);
  const finalValidation = validatePlanVersion(normalized, {
    codeContext: options.codeContext,
    projectType: options.projectType
  });
  const allIssues = [...initialValidation.issues, ...finalValidation.issues];
  const scores = calculateScores(normalized, allIssues, options);
  const validationWarnings = Array.from(new Set(allIssues.map((issue) => issue.message)));
  const floorValidationSummary = buildFloorValidationSummary(normalized, finalValidation.issues);
  const repairs = Array.from(new Set([...openingEnforced.repairs, ...repaired.repairs]));

  return {
    ...normalized,
    scores,
    metadata: {
      ...normalized.metadata,
      validationWarnings,
      floorValidationSummary,
      repairs
    }
  };
}

export function postProcessPlanVersions(drafts: PlanVersionDraft[], options: PostProcessOptions = {}) {
  return drafts.map((draft) => postProcessPlanVersion(draft, options));
}
