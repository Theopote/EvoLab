import type { ScoringConfig } from "@/lib/building-domain";
import {
  buildComplianceContext,
  findComplianceResultById,
  runComplianceCheck,
  type ComplianceResult
} from "@/lib/compliance-rules";
import { captureInpaintImagesFromBBox } from "@/lib/inpaint-capture";
import { getResolvedLevel, resolveLevelRooms } from "@/lib/level-rooms";
import type { SelectionBBox } from "@/lib/region-lock";
import { bboxFromPoints } from "@/lib/region-lock";
import type { PlanVersion, Point } from "@/lib/project-types";
import { computeEgressPathMetrics } from "@/lib/rules/path-metrics";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import type { RulePack } from "@/lib/rules/types";
import type { StructuralConstraintSet } from "@/lib/structural-constraints";
import { buildAlignmentFixPackage } from "@/lib/vertical-alignment-fix";
import { buildVerticalAlignmentReport } from "@/lib/vertical-alignment";

export interface ComplianceFixPackage {
  violationId: string;
  ruleId: string;
  levelId: string;
  floorName: string;
  userRequest: string;
  structuralConstraints?: StructuralConstraintSet;
  allowedRoomIds: string[];
  maskBBox: SelectionBBox;
  highlightRoomIds: string[];
}

export interface ComplianceFixPreview {
  version: PlanVersion;
  prompt: string;
  warning?: string;
  highlightRoomIds: string[];
  fixPackage: ComplianceFixPackage;
}

export interface ComplianceFixOptions {
  buildingType?: string;
  scoringConfig?: ScoringConfig;
  rulePack?: RulePack;
}

function roomsForMask(version: PlanVersion, levelId: string, roomIds: string[]) {
  const resolved = getResolvedLevel(version, levelId);
  const rooms = resolved?.rooms ?? [];
  const selected = rooms.filter((room) => roomIds.includes(room.id));
  return selected.length ? selected : rooms;
}

function bboxForRooms(rooms: Array<{ polygon: Point[] }>, padding = 2): SelectionBBox | undefined {
  return bboxFromPoints(rooms.flatMap((room) => room.polygon), padding);
}

function resolveWorstEgressLevelId(version: PlanVersion) {
  let worstLevelId = version.levels[0]?.id ?? "level-01";
  let worstDistance = 0;

  version.levels.forEach((level) => {
    const metrics = computeEgressPathMetrics(version, level.id);
    if (metrics.maxDistance > worstDistance) {
      worstDistance = metrics.maxDistance;
      worstLevelId = level.id;
    }
  });

  return worstLevelId;
}

function buildEgressDistanceFixPackage(
  version: PlanVersion,
  result: ComplianceResult,
  rulePack: RulePack
): ComplianceFixPackage | undefined {
  const levelId = result.levelId ?? resolveWorstEgressLevelId(version);
  const level = version.levels.find((item) => item.id === levelId);

  if (!level) {
    return undefined;
  }

  const egressMetrics = computeEgressPathMetrics(version, levelId);
  const resolved = getResolvedLevel(version, levelId);
  const rooms = resolved?.rooms ?? [];
  const egressMaxDistance = rulePack.scoring.egressMaxDistanceM;
  const worstRoom =
    rooms.find((room) => room.id === egressMetrics.worstRoomId) ??
    rooms.find((room) => room.type === "corridor") ??
    rooms[0];

  if (!worstRoom) {
    return undefined;
  }

  const corridorRooms = rooms.filter((room) => room.type === "corridor");
  const stairRooms = rooms.filter((room) => room.type === "stair" || room.type === "elevator");
  const relatedRoomIds = [
    worstRoom.id,
    ...corridorRooms.map((room) => room.id),
    ...stairRooms.map((room) => room.id)
  ];
  const allowedRoomIds = [...new Set(relatedRoomIds)];
  const maskRooms = roomsForMask(version, levelId, allowedRoomIds);
  const maskBBox = bboxForRooms(maskRooms, 2.5);

  if (!maskBBox) {
    return undefined;
  }

  const targetLabel = egressMetrics.worstRoomName ?? worstRoom.name;

  return {
    violationId: result.id,
    ruleId: result.ruleId,
    levelId,
    floorName: level.name,
    userRequest: `On ${level.name}, improve egress for ${targetLabel} so travel distance drops below ${egressMaxDistance}m. Adjust corridor width, door placement, or room boundaries inside the masked region, but keep stair and elevator core positions stable unless absolutely necessary.`,
    allowedRoomIds,
    maskBBox,
    highlightRoomIds: allowedRoomIds
  };
}

function buildStairEgressWidthFixPackage(version: PlanVersion, result: ComplianceResult): ComplianceFixPackage | undefined {
  const targetLevel =
    version.levels.find((level) =>
      resolveLevelRooms(level, version.standardFloorGroups).some((room) => room.type === "stair")
    ) ?? version.levels[0];

  if (!targetLevel) {
    return undefined;
  }

  const resolved = getResolvedLevel(version, targetLevel.id);
  const rooms = resolved?.rooms ?? [];
  const stairRooms = rooms.filter((room) => room.type === "stair");
  const corridorRooms = rooms.filter((room) => room.type === "corridor");
  const allowedRoomIds = [...stairRooms, ...corridorRooms].map((room) => room.id);

  if (allowedRoomIds.length === 0) {
    return undefined;
  }

  const maskBBox = bboxForRooms(roomsForMask(version, targetLevel.id, allowedRoomIds), 2.5);

  if (!maskBBox) {
    return undefined;
  }

  return {
    violationId: result.id,
    ruleId: result.ruleId,
    levelId: targetLevel.id,
    floorName: targetLevel.name,
    userRequest: `On ${targetLevel.name}, widen stair egress capacity by expanding stair rooms and adjacent corridor segments. Do not relocate vertical structural elements; adjust surrounding layout only.`,
    allowedRoomIds,
    maskBBox,
    highlightRoomIds: allowedRoomIds
  };
}

function buildVerticalAlignmentFixPackage(
  version: PlanVersion,
  result: ComplianceResult
): ComplianceFixPackage | undefined {
  const issue = buildVerticalAlignmentReport(version).issues.find((item) => item.id === result.id);

  if (!issue) {
    return undefined;
  }

  const alignmentPackage = buildAlignmentFixPackage(version, issue);

  if (!alignmentPackage) {
    return undefined;
  }

  return {
    violationId: result.id,
    ruleId: result.ruleId,
    levelId: alignmentPackage.levelId,
    floorName: alignmentPackage.floorName,
    userRequest: alignmentPackage.userRequest,
    structuralConstraints: alignmentPackage.structuralConstraints,
    allowedRoomIds: alignmentPackage.allowedRoomIds,
    maskBBox: alignmentPackage.maskBBox,
    highlightRoomIds: alignmentPackage.highlightRoomIds
  };
}

export function buildComplianceFixPackage(
  version: PlanVersion,
  result: ComplianceResult,
  options: ComplianceFixOptions = {}
): ComplianceFixPackage | undefined {
  if (result.status !== "warning" || !result.fixActionId) {
    return undefined;
  }

  const rulePack =
    options.rulePack ??
    resolveRulePack({
      projectType: options.buildingType ?? "healthcare"
    });

  if (result.ruleId === "vertical_alignment" && result.fixScope === "single_floor") {
    return buildVerticalAlignmentFixPackage(version, result);
  }

  if (result.ruleId === "egress-distance") {
    return buildEgressDistanceFixPackage(version, result, rulePack);
  }

  if (result.ruleId === "stair-egress-width") {
    return buildStairEgressWidthFixPackage(version, result);
  }

  return undefined;
}

export function buildComplianceFixPackageById(
  version: PlanVersion,
  violationId: string,
  options: ComplianceFixOptions = {}
): ComplianceFixPackage | undefined {
  const result = findComplianceResultById(version, violationId, options);

  if (!result) {
    return undefined;
  }

  return buildComplianceFixPackage(version, result, options);
}

export async function requestComplianceFixPreview(
  version: PlanVersion,
  fixPackage: ComplianceFixPackage
): Promise<ComplianceFixPreview> {
  const { baseImage, maskImage } = await captureInpaintImagesFromBBox(
    version,
    fixPackage.maskBBox,
    fixPackage.levelId
  );

  const response = await fetch("/api/inpaint-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentVersion: version,
      userRequest: fixPackage.userRequest,
      baseImage,
      maskImage,
      allowedRoomIds: fixPackage.allowedRoomIds,
      levelId: fixPackage.levelId,
      structuralConstraints: fixPackage.structuralConstraints
    })
  });

  const data = (await response.json()) as {
    version?: PlanVersion;
    warning?: string;
    structuralViolations?: string[];
    error?: string;
  };

  if (!response.ok || !data.version?.rooms) {
    throw new Error(data.error ?? `inpaint-plan failed with ${response.status}`);
  }

  const warning = [data.warning, ...(data.structuralViolations ?? [])].filter(Boolean).join(" ");

  return {
    version: data.version,
    prompt: fixPackage.userRequest,
    warning: warning || undefined,
    highlightRoomIds: fixPackage.highlightRoomIds,
    fixPackage
  };
}

export function listFixableComplianceResults(
  version: PlanVersion,
  options: ComplianceFixOptions = {}
): ComplianceResult[] {
  const rulePack =
    options.rulePack ??
    resolveRulePack({
      projectType: options.buildingType ?? "healthcare"
    });
  const ctx = buildComplianceContext(version, rulePack, {
    buildingType: options.buildingType ?? "healthcare",
    scoringConfig: options.scoringConfig
  });

  return runComplianceCheck(ctx).filter((result) => result.status === "warning" && Boolean(result.fixActionId));
}
