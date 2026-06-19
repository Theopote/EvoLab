import type { ScoringConfig } from "@/lib/building-domain";
import {
  buildComplianceContext,
  findComplianceResultById,
  runComplianceCheck,
  type ComplianceResult
} from "@/lib/compliance-rules";
import { captureInpaintImagesFromBBox } from "@/lib/inpaint-capture";
import { buildComplianceFixProposal } from "@/lib/compliance-fix-proposal";
import { buildPreviewVersion } from "@/lib/plan-change-engine";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import type { ModifyPlanResponse } from "@/lib/copilot-modify-types";
import { getResolvedLevel, resolveLevelRooms } from "@/lib/level-rooms";
import type { SelectionBBox } from "@/lib/region-lock";
import { bboxFromPoints } from "@/lib/region-lock";
import type { PlanVersion, Point, CopilotAction, Room } from "@/lib/project-types";
import { computeEgressPathMetrics, computeWetCorePathMetrics } from "@/lib/rules/path-metrics";
import { checkDaylightCompliance } from "@/lib/rules/metrics/daylight-compliance";
import { measureCorridorsClearWidth } from "@/lib/rules/metrics/corridor-width";
import { ruleThreshold } from "@/lib/rules/rule-pack";
import type { RulePack } from "@/lib/rules/types";
import { resolveRulePack } from "@/lib/rules/rule-pack";
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
  proposal: PlanChangeProposal;
  version: PlanVersion;
  prompt: string;
  warning?: string;
  highlightRoomIds: string[];
  fixPackage: ComplianceFixPackage;
  fallback?: boolean;
}

export interface ComplianceFixOptions {
  buildingType?: string;
  scoringConfig?: ScoringConfig;
  rulePack?: RulePack;
}

export function isComplianceFixAction(action: CopilotAction) {
  return action.id === "optimize-egress" || action.id === "apply-compliance-fix";
}

function resolveRulePackFromOptions(options: ComplianceFixOptions): RulePack {
  return (
    options.rulePack ??
    resolveRulePack({
      projectType: options.buildingType ?? "healthcare"
    })
  );
}

function packageFromRooms(
  version: PlanVersion,
  result: ComplianceResult,
  levelId: string,
  allowedRoomIds: string[],
  userRequest: string,
  extras?: { structuralConstraints?: StructuralConstraintSet; padding?: number }
): ComplianceFixPackage | undefined {
  const level = version.levels.find((item) => item.id === levelId);

  if (!level || allowedRoomIds.length === 0) {
    return undefined;
  }

  const maskBBox = bboxForRooms(roomsForMask(version, levelId, allowedRoomIds), extras?.padding ?? 2.5);

  if (!maskBBox) {
    return undefined;
  }

  return {
    violationId: result.id,
    ruleId: result.ruleId,
    levelId,
    floorName: level.name,
    userRequest,
    allowedRoomIds,
    maskBBox,
    highlightRoomIds: allowedRoomIds,
    structuralConstraints: extras?.structuralConstraints
  };
}

function resolveLevelIdForRule(version: PlanVersion, result: ComplianceResult, rulePack: RulePack) {
  if (result.levelId) {
    return result.levelId;
  }

  if (result.ruleId === "egress-distance") {
    return resolveWorstEgressLevelId(version);
  }

  if (result.ruleId === "corridor-width") {
    let worstLevelId = version.levels[0]?.id ?? "level-01";
    let narrowest = Infinity;

    version.levels.forEach((level) => {
      const rooms = resolveLevelRooms(level, version.standardFloorGroups);
      const corridorMinWidth = ruleThreshold(rulePack, "corridor-width", 1.2);
      const widths = measureCorridorsClearWidth(rooms.filter((room) => room.type === "corridor"));
      const minWidth = widths.length ? Math.min(...widths.map((item) => item.clearWidthM)) : Infinity;

      if (minWidth < narrowest) {
        narrowest = minWidth;
        worstLevelId = level.id;
      }

      if (widths.some((item) => item.clearWidthM < corridorMinWidth) && minWidth <= narrowest) {
        worstLevelId = level.id;
      }
    });

    return worstLevelId;
  }

  if (result.ruleId === "daylight") {
    return resolveWorstDaylightLevelId(version, rulePack);
  }

  if (result.ruleId === "plumbing-proximity") {
    return resolveWorstPlumbingLevelId(version, rulePack);
  }

  if (result.ruleId === "stair-count") {
    return (
      version.levels.find((level) => {
        const rooms = resolveLevelRooms(level, version.standardFloorGroups);
        return !rooms.some((room) => room.type === "stair" || room.type === "elevator");
      })?.id ?? version.levels[0]?.id ?? "level-01"
    );
  }

  if (result.ruleId === "equipment-shaft-alignment") {
    return resolveWorstEquipmentLevelId(version);
  }

  return version.levels[0]?.id ?? "level-01";
}

function resolveWorstDaylightLevelId(version: PlanVersion, rulePack: RulePack) {
  let worstLevelId = version.levels[0]?.id ?? "level-01";
  let worstCount = -1;

  version.levels.forEach((level) => {
    const rooms = resolveLevelRooms(level, version.standardFloorGroups).filter((room) => room.needsDaylight);
    const failures = checkDaylightCompliance(version, rooms, rulePack.scoring.daylightMaxDepthM).filter(
      (item) => !item.compliant
    ).length;

    if (failures > worstCount) {
      worstCount = failures;
      worstLevelId = level.id;
    }
  });

  return worstLevelId;
}

function resolveWorstPlumbingLevelId(version: PlanVersion, rulePack: RulePack) {
  let worstLevelId = version.levels[0]?.id ?? "level-01";
  let worstCount = -1;

  version.levels.forEach((level) => {
    const metrics = computeWetCorePathMetrics(version, level.id);
    const issues = metrics.perRoom.filter(
      (item) => item.distance > rulePack.scoring.plumbingMaxDistanceM || (item.missingLinks?.length ?? 0) > 0
    ).length;

    if (issues > worstCount) {
      worstCount = issues;
      worstLevelId = level.id;
    }
  });

  return worstLevelId;
}

function resolveWorstEquipmentLevelId(version: PlanVersion) {
  let worstLevelId = version.levels[0]?.id ?? "level-01";
  let worstCount = -1;

  version.levels.forEach((level) => {
    const rooms = resolveLevelRooms(level, version.standardFloorGroups);
    const shaftOrEquipmentRooms = rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
    const equipmentRooms = rooms.filter((room) => room.type === "equipment_room");
    const misaligned = equipmentRooms.filter((room) => {
      const roomCenter = centroid(room);
      const nearest = Math.min(
        ...shaftOrEquipmentRooms
          .filter((target) => target.id !== room.id)
          .map((target) => distance(roomCenter, centroid(target))),
        Infinity
      );
      return nearest > 10;
    }).length;

    if (misaligned > worstCount) {
      worstCount = misaligned;
      worstLevelId = level.id;
    }
  });

  return worstLevelId;
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function uniqueRoomIds(roomIds: string[]) {
  return [...new Set(roomIds)];
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

function buildCorridorWidthFixPackage(
  version: PlanVersion,
  result: ComplianceResult,
  rulePack: RulePack
): ComplianceFixPackage | undefined {
  const levelId = resolveLevelIdForRule(version, result, rulePack);
  const resolved = getResolvedLevel(version, levelId);
  const rooms = resolved?.rooms ?? [];
  const corridorMinWidth = ruleThreshold(rulePack, "corridor-width", 1.2);
  const corridorRooms = rooms.filter((room) => room.type === "corridor");
  const narrowCorridors = measureCorridorsClearWidth(corridorRooms).filter(
    (item) => item.clearWidthM < corridorMinWidth
  );
  const targetCorridorIds = narrowCorridors.map((item) => item.roomId);
  const adjacentRooms = rooms.filter((room) => room.type !== "shaft" && room.type !== "stair");
  const allowedRoomIds = uniqueRoomIds([
    ...targetCorridorIds,
    ...adjacentRooms.map((room) => room.id)
  ]);

  return packageFromRooms(
    version,
    result,
    levelId,
    allowedRoomIds,
    `On ${resolved?.name ?? levelId}, widen narrow corridor segments to at least ${corridorMinWidth}m clear width by reshaping adjacent room boundaries inside the masked region.`,
    { padding: 2.5 }
  );
}

function buildDaylightFixPackage(
  version: PlanVersion,
  result: ComplianceResult,
  rulePack: RulePack
): ComplianceFixPackage | undefined {
  const levelId = resolveLevelIdForRule(version, result, rulePack);
  const resolved = getResolvedLevel(version, levelId);
  const rooms = resolved?.rooms ?? [];
  const daylightMaxDepth = rulePack.scoring.daylightMaxDepthM;
  const failingRooms = checkDaylightCompliance(
    version,
    rooms.filter((room) => room.needsDaylight),
    daylightMaxDepth
  ).filter((item) => !item.compliant);
  const failingRoomIds = failingRooms.map((item) => item.roomId);
  const corridorRooms = rooms.filter((room) => room.type === "corridor");
  const allowedRoomIds = uniqueRoomIds([...failingRoomIds, ...corridorRooms.map((room) => room.id)]);

  return packageFromRooms(
    version,
    result,
    levelId,
    allowedRoomIds,
    `On ${resolved?.name ?? levelId}, improve daylight for rooms that need exterior windows or shallower depth (max ${daylightMaxDepth}m). Add or adjust windows on exterior walls and reshape room depth inside the masked region.`,
    { padding: 2.5 }
  );
}

function buildPlumbingProximityFixPackage(
  version: PlanVersion,
  result: ComplianceResult,
  rulePack: RulePack
): ComplianceFixPackage | undefined {
  const levelId = resolveLevelIdForRule(version, result, rulePack);
  const resolved = getResolvedLevel(version, levelId);
  const rooms = resolved?.rooms ?? [];
  const plumbingMaxDistance = rulePack.scoring.plumbingMaxDistanceM;
  const wetCoreMetrics = computeWetCorePathMetrics(version, levelId);
  const wetRoomIds = wetCoreMetrics.perRoom
    .filter((item) => item.distance > plumbingMaxDistance || (item.missingLinks?.length ?? 0) > 0)
    .map((item) => item.roomId);
  const shaftRooms = rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const allowedRoomIds = uniqueRoomIds([...wetRoomIds, ...shaftRooms.map((room) => room.id)]);

  return packageFromRooms(
    version,
    result,
    levelId,
    allowedRoomIds,
    `On ${resolved?.name ?? levelId}, move or reshape wet rooms so they sit within ${plumbingMaxDistance}m of a shaft stack and preserve vertical riser alignment where possible.`,
    { padding: 2.5 }
  );
}

function buildStairCountFixPackage(
  version: PlanVersion,
  result: ComplianceResult,
  rulePack: RulePack
): ComplianceFixPackage | undefined {
  const levelId = resolveLevelIdForRule(version, result, rulePack);
  const resolved = getResolvedLevel(version, levelId);
  const rooms = resolved?.rooms ?? [];
  const corridorRooms = rooms.filter((room) => room.type === "corridor" || room.type === "lobby");
  const allowedRoomIds = corridorRooms.map((room) => room.id);

  return packageFromRooms(
    version,
    result,
    levelId,
    allowedRoomIds,
    `On ${resolved?.name ?? levelId}, add at least one stair or elevator core room connected to the corridor network. Carve core space from corridor or lobby area without breaking the overall circulation loop.`,
    { padding: 3 }
  );
}

function buildEquipmentShaftFixPackage(
  version: PlanVersion,
  result: ComplianceResult,
  rulePack: RulePack
): ComplianceFixPackage | undefined {
  const levelId = resolveLevelIdForRule(version, result, rulePack);
  const resolved = getResolvedLevel(version, levelId);
  const rooms = resolved?.rooms ?? [];
  const shaftOrEquipmentRooms = rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const equipmentRooms = rooms.filter((room) => room.type === "equipment_room");
  const misalignedEquipmentRooms = equipmentRooms.filter((room) => {
    const roomCenter = centroid(room);
    const nearest = Math.min(
      ...shaftOrEquipmentRooms
        .filter((target) => target.id !== room.id)
        .map((target) => distance(roomCenter, centroid(target))),
      Infinity
    );
    return nearest > 10;
  });
  const allowedRoomIds = uniqueRoomIds([
    ...misalignedEquipmentRooms.map((room) => room.id),
    ...shaftOrEquipmentRooms.map((room) => room.id)
  ]);

  return packageFromRooms(
    version,
    result,
    levelId,
    allowedRoomIds,
    `On ${resolved?.name ?? levelId}, align equipment rooms with nearby shaft or service rooms by adjusting room boundaries inside the masked region.`,
    { padding: 2.5 }
  );
}

export function buildComplianceFixPackage(
  version: PlanVersion,
  result: ComplianceResult,
  options: ComplianceFixOptions = {}
): ComplianceFixPackage | undefined {
  if (result.status !== "warning" || !result.fixActionId) {
    return undefined;
  }

  const rulePack = resolveRulePackFromOptions(options);

  if (result.ruleId === "vertical_alignment" && result.fixScope === "single_floor") {
    return buildVerticalAlignmentFixPackage(version, result);
  }

  if (result.ruleId === "egress-distance") {
    return buildEgressDistanceFixPackage(version, result, rulePack);
  }

  if (result.ruleId === "stair-egress-width") {
    return buildStairEgressWidthFixPackage(version, result);
  }

  if (result.ruleId === "corridor-width") {
    return buildCorridorWidthFixPackage(version, result, rulePack);
  }

  if (result.ruleId === "daylight") {
    return buildDaylightFixPackage(version, result, rulePack);
  }

  if (result.ruleId === "plumbing-proximity") {
    return buildPlumbingProximityFixPackage(version, result, rulePack);
  }

  if (result.ruleId === "stair-count") {
    return buildStairCountFixPackage(version, result, rulePack);
  }

  if (result.ruleId === "equipment-shaft-alignment") {
    return buildEquipmentShaftFixPackage(version, result, rulePack);
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
  fixPackage: ComplianceFixPackage,
  options: ComplianceFixOptions = {}
): Promise<ComplianceFixPreview> {
  const deterministicProposal = buildComplianceFixProposal(version, fixPackage, options);

  if (deterministicProposal?.operations.length) {
    const previewVersion = buildPreviewVersion(version, deterministicProposal, {
      allowedRoomIds: fixPackage.allowedRoomIds,
      versionLabel: `${version.label} / Compliance fix`
    });

    return {
      proposal: deterministicProposal,
      version: previewVersion,
      prompt: fixPackage.userRequest,
      highlightRoomIds: fixPackage.highlightRoomIds,
      fixPackage
    };
  }

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

  const data = (await response.json()) as ModifyPlanResponse & {
    structuralViolations?: string[];
    error?: string;
  };

  if (!response.ok || !data.version?.rooms || !data.proposal?.operations?.length) {
    throw new Error(data.error ?? `inpaint-plan failed with ${response.status}`);
  }

  const warning = [data.warning, ...(data.structuralViolations ?? [])].filter(Boolean).join(" ");

  return {
    proposal: data.proposal,
    version: data.version,
    prompt: fixPackage.userRequest,
    warning: warning || undefined,
    highlightRoomIds: fixPackage.highlightRoomIds,
    fixPackage,
    fallback: data.fallback
  };
}

export function listFixableComplianceResults(
  version: PlanVersion,
  options: ComplianceFixOptions = {}
): ComplianceResult[] {
  const rulePack = resolveRulePackFromOptions(options);
  const ctx = buildComplianceContext(version, rulePack, {
    buildingType: options.buildingType ?? "healthcare",
    scoringConfig: options.scoringConfig
  });

  return runComplianceCheck(ctx).filter((result) => result.status === "warning" && Boolean(result.fixActionId));
}
