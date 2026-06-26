import type { ScoringConfig } from "@/lib/building-domain";
import { computeLevelElevations } from "@/lib/floor-elevation";
import { resolveLevelRooms } from "@/lib/level-rooms";
import type { PlanVersion, Point, Room, VerticalElement } from "@/lib/project-types";
import type { CopilotActionId, CopilotFinding } from "@/lib/project-types";
import { computeEgressPathMetrics, computeWetCorePathMetrics, egressMethodLabel } from "@/lib/rules/path-metrics";
import { checkDaylightCompliance } from "@/lib/rules/metrics/daylight-compliance";
import { measureCorridorsClearWidth } from "@/lib/rules/metrics/corridor-width";
import { resolveRulePack, ruleBasis, ruleThreshold } from "@/lib/rules/rule-pack";
import type { RulePack } from "@/lib/rules/types";
import { buildVerticalAlignmentReport } from "@/lib/vertical-alignment";
import { deriveVerticalElements } from "@/lib/vertical-elements";

export type ComplianceScope = "per_floor" | "building_wide";
export type ComplianceSeverity = "low" | "medium" | "high";
export type ComplianceStatus = "success" | "warning";
export type ComplianceFixScope = "single_floor" | "building_wide";

export interface ComplianceResult {
  id: string;
  ruleId: string;
  title: string;
  code: string;
  status: ComplianceStatus;
  severity: ComplianceSeverity;
  scope: ComplianceScope;
  message: string;
  basis: string;
  levelId?: string;
  levelName?: string;
  affectedFloorIds?: string[];
  fixScope?: ComplianceFixScope;
  fixActionId?: CopilotActionId;
}

export interface ComplianceFix {
  violationId: string;
  scope: ComplianceFixScope;
  affectedFloorIds: string[];
}

export interface EgressWidthConfig {
  widthPer100PersonsM: number;
  areaPerOccupantSqm: number;
  notice: string;
}

export interface ComplianceContext {
  version: PlanVersion;
  rulePack: RulePack;
  buildingType: string;
  elevations: Map<string, number>;
  verticalElements: VerticalElement[];
  egressWidth: EgressWidthConfig;
}

export interface ComplianceRule {
  id: string;
  scope: ComplianceScope;
  buildingTypes: string[];
  check: (ctx: ComplianceContext, levelId?: string) => ComplianceResult[];
}

const DEFAULT_WIDTH_PER_100_PERSONS_M: Record<string, number> = {
  healthcare: 0.75,
  office: 0.75,
  residential: 0.65,
  school: 0.75,
  default: 0.75
};

const DEFAULT_AREA_PER_OCCUPANT_SQM: Record<string, number> = {
  healthcare: 10,
  office: 9,
  residential: 25,
  school: 2,
  default: 10
};

const EGRESS_WIDTH_NOTICE =
  "Stair width coefficients vary by local code — verify against the applicable egress table for your jurisdiction.";

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function centroid(room: Room): Point {
  const total = room.polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / room.polygon.length, total[1] / room.polygon.length];
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function nearestDistanceToRooms(room: Room, targets: Room[], version: PlanVersion) {
  if (targets.length === 0) {
    return Infinity;
  }

  const wetMetrics = computeWetCorePathMetrics(version);
  const roomMetric = wetMetrics.perRoom.find((item) => item.roomId === room.id);
  if (roomMetric) {
    return roomMetric.distance;
  }

  const roomCenter = centroid(room);
  return Math.min(...targets.map((target) => distance(roomCenter, centroid(target))));
}

function matchesBuildingType(rule: ComplianceRule, buildingType: string) {
  return rule.buildingTypes.includes("*") || rule.buildingTypes.includes(buildingType);
}

function resultBase(
  ruleId: string,
  title: string,
  code: string,
  scope: ComplianceScope,
  severity: ComplianceSeverity,
  status: ComplianceStatus,
  message: string,
  basis: string,
  extras: Partial<ComplianceResult> = {}
): ComplianceResult {
  const levelId = extras.levelId;

  return {
    id: extras.id ?? (levelId ? `${ruleId}-${levelId}` : ruleId),
    ruleId,
    title,
    code,
    status,
    severity,
    scope,
    message,
    basis,
    ...extras
  };
}

function enrichResultsWithRulePackCodes(results: ComplianceResult[], rulePack: RulePack): ComplianceResult[] {
  return results.map((result) => {
    const packRule = rulePack.rules.find((rule) => rule.id === result.ruleId);

    return {
      ...result,
      code: packRule?.code ?? result.code,
      basis: packRule?.basis ?? result.basis
    };
  });
}

function fixActionForRule(ruleId: string, fixScope?: ComplianceFixScope): CopilotActionId | undefined {
  if (ruleId === "vertical_alignment" && fixScope !== "single_floor") {
    return undefined;
  }

  if (ruleId === "egress-distance" || ruleId === "stair-egress-width") {
    return "optimize-egress";
  }

  if (
    ruleId === "corridor-width" ||
    ruleId === "daylight" ||
    ruleId === "plumbing-proximity" ||
    ruleId === "stair-count" ||
    ruleId === "equipment-shaft-alignment" ||
    ruleId === "vertical_alignment"
  ) {
    return "apply-compliance-fix";
  }

  return undefined;
}

function checkCorridorWidthRule(ctx: ComplianceContext, levelId?: string): ComplianceResult[] {
  const resolvedLevelId = levelId ?? ctx.version.levels[0]?.id ?? "level-01";
  const level = ctx.version.levels.find((item) => item.id === resolvedLevelId);
  const rooms = level ? resolveLevelRooms(level, ctx.version.standardFloorGroups) : [];
  const corridorMinWidth = ruleThreshold(ctx.rulePack, "corridor-width", 1.2);
  const corridorRooms = rooms.filter((room) => room.type === "corridor");
  const corridorWidths = measureCorridorsClearWidth(corridorRooms);
  const narrowCorridors = corridorWidths.filter((item) => item.clearWidthM < corridorMinWidth);
  const levelName = level?.name ?? resolvedLevelId;

  return [
    resultBase(
      "corridor-width",
      "Corridor clear width",
      "Corridor clear width",
      "per_floor",
      narrowCorridors.length === 0 ? "low" : "high",
      narrowCorridors.length === 0 ? "success" : "warning",
      narrowCorridors.length === 0
        ? `No corridor room is narrower than ${corridorMinWidth}m by clear-width geometry.`
        : `${narrowCorridors.length} corridor room may be narrower than ${corridorMinWidth}m (min clear width ${Math.min(
            ...narrowCorridors.map((item) => item.clearWidthM)
          ).toFixed(1)}m).`,
      ruleBasis(ctx.rulePack, "corridor-width", "Corridor clear width should not be less than 1.2m."),
      {
        levelId: resolvedLevelId,
        levelName,
        affectedFloorIds: [resolvedLevelId],
        fixScope: "single_floor",
        fixActionId: fixActionForRule("corridor-width", "single_floor")
      }
    )
  ];
}

function checkEgressDistanceRule(ctx: ComplianceContext, levelId?: string): ComplianceResult[] {
  const resolvedLevelId = levelId ?? ctx.version.levels[0]?.id ?? "level-01";
  const level = ctx.version.levels.find((item) => item.id === resolvedLevelId);
  const egressMetrics = computeEgressPathMetrics(ctx.version, resolvedLevelId);
  const egressMaxDistance = ctx.rulePack.scoring.egressMaxDistanceM;
  const maxEgressDistance = egressMetrics.maxDistance;
  const egressMethod = egressMetrics.method;
  const egressLabel = egressMethodLabel(egressMethod);
  const egressDistanceOk = maxEgressDistance <= egressMaxDistance;
  const egressSemanticOk =
    egressMethod !== "centroid-fallback" &&
    egressMethod !== "semantic-incomplete" &&
    egressMetrics.incompleteRouteCount === 0 &&
    egressMetrics.fallbackRouteCount === 0;
  const levelName = level?.name ?? resolvedLevelId;

  return [
    resultBase(
      "egress-distance",
      "Egress travel distance",
      "Egress travel distance",
      "per_floor",
      egressDistanceOk && egressSemanticOk ? "low" : "high",
      egressDistanceOk && egressSemanticOk ? "success" : "warning",
      !egressDistanceOk
        ? `Maximum egress path is about ${round(maxEgressDistance)}m via ${egressLabel}${
            egressMetrics.worstRoomName ? ` (${egressMetrics.worstRoomName})` : ""
          }, above ${egressMaxDistance}m.`
        : !egressSemanticOk
          ? `Maximum egress path is about ${round(maxEgressDistance)}m, but ${
              egressMetrics.fallbackRouteCount > 0
                ? `${egressMetrics.fallbackRouteCount} room(s) lack door-corridor-stair geometry for a semantic egress path.`
                : `${egressMetrics.incompleteRouteCount} room(s) reach an exit without a complete door → corridor → stair chain.`
            }`
          : `Maximum egress path is about ${round(maxEgressDistance)}m via ${egressLabel}.`,
      ruleBasis(ctx.rulePack, "egress-distance", "Egress travel distance should not exceed 30m."),
      {
        levelId: resolvedLevelId,
        levelName,
        affectedFloorIds: [resolvedLevelId],
        fixScope: "single_floor",
        fixActionId: fixActionForRule("egress-distance", "single_floor")
      }
    )
  ];
}

function checkDaylightRule(ctx: ComplianceContext, levelId?: string): ComplianceResult[] {
  const resolvedLevelId = levelId ?? ctx.version.levels[0]?.id ?? "level-01";
  const level = ctx.version.levels.find((item) => item.id === resolvedLevelId);
  const rooms = level ? resolveLevelRooms(level, ctx.version.standardFloorGroups) : [];
  const daylightMaxDepth = ctx.rulePack.scoring.daylightMaxDepthM;
  const roomsNeedingDaylight = rooms.filter((room) => room.needsDaylight);
  const daylightResults = checkDaylightCompliance(ctx.version, roomsNeedingDaylight, daylightMaxDepth);
  const roomsWithoutDaylight = daylightResults.filter((item) => !item.compliant);
  const levelName = level?.name ?? resolvedLevelId;

  return [
    resultBase(
      "daylight",
      "Main room daylight",
      "Daylight",
      "per_floor",
      roomsWithoutDaylight.length === 0 ? "low" : "medium",
      roomsWithoutDaylight.length === 0 ? "success" : "warning",
      roomsWithoutDaylight.length === 0
        ? `All ${daylightResults.length} daylight-required rooms meet exterior window and ${daylightMaxDepth}m depth limits.`
        : `${roomsWithoutDaylight.length} daylight-required room fails exterior window, facade contact, or ${daylightMaxDepth}m depth.`,
      `Rooms with needsDaylight should touch an exterior wall, have windows, and stay within ${daylightMaxDepth}m depth.`,
      {
        levelId: resolvedLevelId,
        levelName,
        affectedFloorIds: [resolvedLevelId],
        fixScope: "single_floor",
        fixActionId: fixActionForRule("daylight", "single_floor")
      }
    )
  ];
}

function checkPlumbingProximityRule(ctx: ComplianceContext, levelId?: string): ComplianceResult[] {
  const resolvedLevelId = levelId ?? ctx.version.levels[0]?.id ?? "level-01";
  const level = ctx.version.levels.find((item) => item.id === resolvedLevelId);
  const plumbingMaxDistance = ctx.rulePack.scoring.plumbingMaxDistanceM;
  const wetCoreMetrics = computeWetCorePathMetrics(ctx.version, resolvedLevelId);
  const wetStackIssues = wetCoreMetrics.perRoom.filter(
    (item) => item.distance > plumbingMaxDistance || (item.missingLinks?.length ?? 0) > 0
  );
  const levelName = level?.name ?? resolvedLevelId;

  return [
    resultBase(
      "plumbing-proximity",
      "Plumbing proximity",
      "Plumbing proximity",
      "per_floor",
      wetStackIssues.length === 0 ? "low" : "medium",
      wetStackIssues.length === 0 ? "success" : "warning",
      wetStackIssues.length === 0
        ? "Wet rooms reach a shaft stack via horizontal path with riser alignment where multi-floor stacks exist."
        : `${wetStackIssues.length} wet room may exceed ${plumbingMaxDistance}m stack path or lacks vertical riser alignment.`,
      `Wet rooms should reach a shaft stack within ${plumbingMaxDistance}m horizontal path and align to a vertical riser.`,
      {
        levelId: resolvedLevelId,
        levelName,
        affectedFloorIds: [resolvedLevelId],
        fixScope: "single_floor",
        fixActionId: fixActionForRule("plumbing-proximity", "single_floor")
      }
    )
  ];
}

function checkStairCountRule(ctx: ComplianceContext, levelId?: string): ComplianceResult[] {
  const resolvedLevelId = levelId ?? ctx.version.levels[0]?.id ?? "level-01";
  const level = ctx.version.levels.find((item) => item.id === resolvedLevelId);
  const rooms = level ? resolveLevelRooms(level, ctx.version.standardFloorGroups) : [];
  const stairRooms = rooms.filter((room) => room.type === "stair" || room.type === "elevator");
  const minCoreCount = ruleThreshold(ctx.rulePack, "stair-count", 1);
  const levelName = level?.name ?? resolvedLevelId;

  return [
    resultBase(
      "stair-count",
      "Stair and vertical core count",
      "Vertical core count",
      "per_floor",
      stairRooms.length >= minCoreCount ? "low" : "high",
      stairRooms.length >= minCoreCount ? "success" : "warning",
      stairRooms.length >= minCoreCount
        ? `${stairRooms.length} vertical core room is present.`
        : "No stair or elevator core room is present.",
      ruleBasis(ctx.rulePack, "stair-count", "At least one stair/elevator core should exist."),
      {
        levelId: resolvedLevelId,
        levelName,
        affectedFloorIds: [resolvedLevelId],
        fixScope: "single_floor",
        fixActionId: fixActionForRule("stair-count", "single_floor")
      }
    )
  ];
}

function checkEquipmentShaftAlignmentRule(ctx: ComplianceContext, levelId?: string): ComplianceResult[] {
  const resolvedLevelId = levelId ?? ctx.version.levels[0]?.id ?? "level-01";
  const level = ctx.version.levels.find((item) => item.id === resolvedLevelId);
  const rooms = level ? resolveLevelRooms(level, ctx.version.standardFloorGroups) : [];
  const shaftOrEquipmentRooms = rooms.filter((room) => room.type === "shaft" || room.type === "equipment_room");
  const equipmentRooms = rooms.filter((room) => room.type === "equipment_room");
  const misalignedEquipmentRooms = equipmentRooms.filter((room) =>
    nearestDistanceToRooms(
      room,
      shaftOrEquipmentRooms.filter((target) => target.id !== room.id),
      ctx.version
    ) > 10
  );
  const levelName = level?.name ?? resolvedLevelId;

  return [
    resultBase(
      "equipment-shaft-alignment",
      "Equipment and shaft alignment",
      "Equipment and shaft alignment",
      "per_floor",
      misalignedEquipmentRooms.length === 0 ? "low" : "medium",
      misalignedEquipmentRooms.length === 0 ? "success" : "warning",
      misalignedEquipmentRooms.length === 0
        ? "Equipment rooms are aligned with a shaft or service room by distance check."
        : `${misalignedEquipmentRooms.length} equipment room may not align with shafts.`,
      "Example rule: equipment rooms should align with shafts or service risers.",
      {
        levelId: resolvedLevelId,
        levelName,
        affectedFloorIds: [resolvedLevelId],
        fixScope: "single_floor",
        fixActionId: fixActionForRule("equipment-shaft-alignment", "single_floor")
      }
    )
  ];
}

function computeOccupantLoad(rooms: Room[], areaPerOccupantSqm: number) {
  const occupiable = rooms.filter(
    (room) => !["corridor", "shaft", "stair", "elevator", "lobby"].includes(room.type)
  );
  const area = occupiable.reduce((total, room) => total + room.areaSqm, 0);
  return areaPerOccupantSqm > 0 ? area / areaPerOccupantSqm : 0;
}

function approximateStairClearWidthM(room: Room) {
  return Math.max(1, Math.sqrt(Math.max(room.areaSqm, 1)));
}

function computeRequiredStairWidth(totalOccupants: number, widthPer100PersonsM: number) {
  return (totalOccupants / 100) * widthPer100PersonsM;
}

function checkStairEgressWidthRule(ctx: ComplianceContext): ComplianceResult[] {
  if (ctx.version.levels.length <= 1) {
    return [];
  }

  const config = ctx.egressWidth;
  const totalOccupants = ctx.version.levels.reduce((total, level) => {
    const rooms = resolveLevelRooms(level, ctx.version.standardFloorGroups);
    return total + computeOccupantLoad(rooms, config.areaPerOccupantSqm);
  }, 0);
  const requiredWidthM = computeRequiredStairWidth(totalOccupants, config.widthPer100PersonsM);
  const stairRooms = ctx.version.levels.flatMap((level) =>
    resolveLevelRooms(level, ctx.version.standardFloorGroups).filter((room) => room.type === "stair")
  );
  const availableWidthM = stairRooms.reduce((total, room) => total + approximateStairClearWidthM(room), 0);
  const ok = stairRooms.length > 0 && availableWidthM >= requiredWidthM;

  return [
    resultBase(
      "stair-egress-width",
      "Stair egress width (building cumulative load)",
      "Stair egress width",
      "building_wide",
      ok ? "low" : "high",
      ok ? "success" : "warning",
      ok
        ? `Estimated stair clear width (${round(availableWidthM)}m) meets cumulative occupant load (${Math.round(totalOccupants)} persons, requires ~${round(requiredWidthM)}m).`
        : stairRooms.length === 0
          ? `Cumulative occupant load (${Math.round(totalOccupants)} persons) requires ~${round(requiredWidthM)}m stair width, but no stair rooms were found.`
          : `Estimated stair clear width (${round(availableWidthM)}m) may be insufficient for cumulative occupant load (${Math.round(totalOccupants)} persons, requires ~${round(requiredWidthM)}m).`,
      `${config.notice} Uses ${config.widthPer100PersonsM}m per 100 persons and ${config.areaPerOccupantSqm} sqm per occupant.`,
      {
        affectedFloorIds: ctx.version.levels.map((level) => level.id),
        fixScope: "building_wide",
        fixActionId: fixActionForRule("stair-egress-width", "building_wide")
      }
    )
  ];
}

function checkVerticalAlignmentRule(ctx: ComplianceContext): ComplianceResult[] {
  if (ctx.version.levels.length <= 1) {
    return [];
  }

  const report = buildVerticalAlignmentReport(ctx.version);

  if (report.aligned) {
    return [
      resultBase(
        "vertical_alignment",
        "Vertical structural alignment",
        "Vertical structural alignment",
        "building_wide",
        "low",
        "success",
        "Grid columns and vertical cores are contained on all served floors.",
        "Columns and cores must have a valid container room on every served floor.",
        {
          id: "vertical-alignment-summary",
          fixScope: "building_wide"
        }
      )
    ];
  }

  const results: ComplianceResult[] = report.issues.map((issue) =>
    resultBase(
      "vertical_alignment",
      "Vertical structural alignment",
      "Vertical structural alignment",
      "building_wide",
      "high",
      "warning",
      issue.message,
      "Columns and cores must have a valid container room on every served floor.",
      {
        id: issue.id,
        levelId: issue.floorId,
        levelName: issue.floorName,
        affectedFloorIds: [issue.floorId],
        fixScope: "single_floor",
        fixActionId: fixActionForRule("vertical_alignment", "single_floor")
      }
    )
  );

  report.transferHints.forEach((hint) => {
    results.push(
      resultBase(
        "vertical_alignment",
        "Transfer floor suggested",
        "Transfer floor",
        "building_wide",
        "medium",
        "warning",
        hint.message,
        "Column grid shifts between unlike floor programs should use an explicit transfer floor.",
        {
          id: hint.id,
          fixScope: "building_wide"
        }
      )
    );
  });

  return results;
}

const perFloorRuleChecks = [
  checkCorridorWidthRule,
  checkEgressDistanceRule,
  checkDaylightRule,
  checkPlumbingProximityRule,
  checkStairCountRule,
  checkEquipmentShaftAlignmentRule
];

export const complianceRules: ComplianceRule[] = [
  ...perFloorRuleChecks.map((check, index) => ({
    id: [
      "corridor-width",
      "egress-distance",
      "daylight",
      "plumbing-proximity",
      "stair-count",
      "equipment-shaft-alignment"
    ][index]!,
    scope: "per_floor" as const,
    buildingTypes: ["*"],
    check
  })),
  {
    id: "stair-egress-width",
    scope: "building_wide",
    buildingTypes: ["*"],
    check: (ctx) => checkStairEgressWidthRule(ctx)
  },
  {
    id: "vertical_alignment",
    scope: "building_wide",
    buildingTypes: ["*"],
    check: (ctx) => checkVerticalAlignmentRule(ctx)
  }
];

export function resolveEgressWidthConfig(
  buildingType: string,
  scoringConfig?: ScoringConfig
): EgressWidthConfig {
  const normalizedType = buildingType.toLowerCase();
  const override = scoringConfig?.egressWidth;

  return {
    widthPer100PersonsM:
      override?.widthPer100PersonsM ??
      DEFAULT_WIDTH_PER_100_PERSONS_M[normalizedType] ??
      DEFAULT_WIDTH_PER_100_PERSONS_M.default!,
    areaPerOccupantSqm:
      override?.areaPerOccupantSqm ??
      DEFAULT_AREA_PER_OCCUPANT_SQM[normalizedType] ??
      DEFAULT_AREA_PER_OCCUPANT_SQM.default!,
    notice: override?.notice ?? EGRESS_WIDTH_NOTICE
  };
}

export function buildComplianceContext(
  version: PlanVersion,
  rulePack: RulePack,
  options: { buildingType?: string; scoringConfig?: ScoringConfig } = {}
): ComplianceContext {
  const buildingType = options.buildingType ?? "healthcare";

  return {
    version,
    rulePack,
    buildingType,
    elevations: computeLevelElevations(version.levels),
    verticalElements: version.verticalElements ?? deriveVerticalElements(version),
    egressWidth: resolveEgressWidthConfig(buildingType, options.scoringConfig)
  };
}

export interface ComplianceCheckOptions {
  /** When true, collapse per-floor rule results to one row per rule (worst case). */
  rollupPerFloor?: boolean;
}

function rollupPerFloorResults(results: ComplianceResult[]): ComplianceResult[] {
  const rollup = new Map<string, ComplianceResult>();

  results.forEach((item) => {
    const existing = rollup.get(item.ruleId);

    if (!existing || (existing.status === "success" && item.status === "warning")) {
      rollup.set(item.ruleId, {
        ...item,
        id: item.ruleId,
        message:
          item.status === "warning" && item.levelName
            ? `${item.message} Worst case on ${item.levelName}.`
            : item.message,
        levelId: undefined,
        levelName: undefined
      });
    }
  });

  return [...rollup.values()];
}

export function runComplianceCheck(
  ctx: ComplianceContext,
  options: ComplianceCheckOptions = {}
): ComplianceResult[] {
  const activeRules = complianceRules.filter((rule) => matchesBuildingType(rule, ctx.buildingType));
  const perFloorRules = activeRules.filter((rule) => rule.scope === "per_floor");
  const buildingWideRules = activeRules.filter((rule) => rule.scope === "building_wide");

  let perFloorResults: ComplianceResult[] = [];

  if (ctx.version.levels.length <= 1) {
    const levelId = ctx.version.levels[0]?.id ?? "level-01";
    perFloorResults = perFloorRules.flatMap((rule) => rule.check(ctx, levelId));
  } else {
    const allLevelResults = ctx.version.levels.flatMap((level) =>
      perFloorRules.flatMap((rule) => rule.check(ctx, level.id))
    );
    perFloorResults = options.rollupPerFloor ? rollupPerFloorResults(allLevelResults) : allLevelResults;
  }

  const buildingWideResults = buildingWideRules.flatMap((rule) => rule.check(ctx));

  return enrichResultsWithRulePackCodes([...perFloorResults, ...buildingWideResults], ctx.rulePack);
}

export function computeRiskCount(results: ComplianceResult[], validationErrors = 0): number {
  const complianceRisks = results.filter(
    (item) => item.status === "warning" && item.severity !== "low"
  ).length;

  return validationErrors + complianceRisks;
}

export function resolveComplianceFix(result: ComplianceResult): ComplianceFix {
  return {
    violationId: result.id,
    scope: result.fixScope ?? (result.scope === "building_wide" ? "building_wide" : "single_floor"),
    affectedFloorIds: result.affectedFloorIds ?? (result.levelId ? [result.levelId] : [])
  };
}

export function fixLabelForResult(result: ComplianceResult) {
  if (result.ruleId === "vertical_alignment" && result.fixScope === "single_floor") {
    return "Adjust floor layout";
  }

  if (result.ruleId === "egress-distance" || result.ruleId === "stair-egress-width") {
    return "Optimize egress";
  }

  if (result.ruleId === "corridor-width") {
    return "Widen corridors";
  }

  if (result.ruleId === "daylight") {
    return "Improve daylight";
  }

  if (result.ruleId === "plumbing-proximity") {
    return "Align wet rooms";
  }

  if (result.ruleId === "equipment-shaft-alignment") {
    return "Align equipment";
  }

  if (result.ruleId === "stair-count") {
    return "Add vertical core";
  }

  return "Apply fix";
}

export function complianceFixLabel(ruleId: string, fixScope?: ComplianceFixScope) {
  return fixLabelForResult({
    id: ruleId,
    ruleId,
    title: ruleId,
    code: ruleId,
    status: "warning",
    severity: "medium",
    scope: fixScope === "building_wide" ? "building_wide" : "per_floor",
    message: "",
    basis: "",
    fixScope
  });
}

function fixLabelForInsight(result: ComplianceResult) {
  return fixLabelForResult(result);
}

export function generateComplianceInsights(results: ComplianceResult[]): CopilotFinding[] {
  return results
    .filter((result) => result.status === "warning" && result.severity !== "low")
    .map((result) => ({
      id: `compliance-${result.id}`,
      tone: result.severity === "high" ? "warning" : "info",
      text: result.levelName ? `[${result.levelName}] ${result.message}` : result.message,
      sub: result.levelName ? `${result.code} · ${result.levelName}` : result.code,
      actions: result.fixActionId
        ? [
            {
              id: result.fixActionId,
              label: fixLabelForInsight(result),
              payload: result.id
            }
          ]
        : undefined
    }));
}

export function prioritizeComplianceResults(results: ComplianceResult[], activeLevelId?: string) {
  if (!activeLevelId) {
    return results;
  }

  return [...results].sort((left, right) => {
    const leftScore = left.levelId === activeLevelId ? 0 : left.scope === "building_wide" ? 1 : 2;
    const rightScore = right.levelId === activeLevelId ? 0 : right.scope === "building_wide" ? 1 : 2;
    return leftScore - rightScore;
  });
}

export function findComplianceResultById(
  version: PlanVersion,
  violationId: string,
  options: { buildingType?: string; scoringConfig?: ScoringConfig; rulePack?: RulePack } = {}
): ComplianceResult | undefined {
  const rulePack =
    options.rulePack ??
    resolveRulePack({ projectType: options.buildingType ?? "healthcare" });
  const ctx = buildComplianceContext(version, rulePack, {
    buildingType: options.buildingType ?? "healthcare",
    scoringConfig: options.scoringConfig
  });

  return runComplianceCheck(ctx).find((result) => result.id === violationId);
}
