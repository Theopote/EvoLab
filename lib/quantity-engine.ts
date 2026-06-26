import type { CodeContext, ScoringConfig } from "@/lib/building-domain";
import { resolveCodeContextFromTypology } from "@/lib/typologies/code-context";
import {
  buildComplianceContext,
  runComplianceCheck,
  type ComplianceResult,
  type ComplianceSeverity,
  type ComplianceScope
} from "@/lib/compliance-rules";
import type { FunctionZone, OpeningElement, PlanVersion, Point, Room, RoomType, Wall, CopilotActionId } from "@/lib/project-types";
import { resolveLevelOutline, resolveLevelRooms } from "@/lib/level-rooms";
import { resolvePlanScope, type PlanScopeKind } from "@/lib/plan-scope";
import {
  resolveMeasurementRuleSet,
  type MeasurementStandardId,
  type QuantityClassification
} from "@/lib/quantity/measurement-standards";
import { computeWallAreaWithOpeningDeductions } from "@/lib/quantity/opening-deductions";
import { estimateStructuralQuantities, type StructuralQuantitySummary } from "@/lib/quantity/structural-quantities";
import { resolveRulePack } from "@/lib/rules/rule-pack";
import type { RulePack } from "@/lib/rules/types";

export interface QuantityRow {
  id: string;
  label: string;
  value: number;
  unit: string;
  basis: string;
  classification?: QuantityClassification;
}

export interface QuantityResult {
  rows: QuantityRow[];
  areaByZone: Record<FunctionZone, number>;
  areaByRoomType: Partial<Record<RoomType, number>>;
  summary: {
    grossArea: number;
    netUsableArea: number;
    externalWallLength: number;
    internalWallLength: number;
    wallArea: number;
    wallAreaGross?: number;
    wallAreaNet?: number;
    openingDeductionArea?: number;
    doorCount: number;
    windowCount: number;
    slabArea: number;
    roofArea: number;
    curtainWallOrWindowArea: number;
    structural?: StructuralQuantitySummary;
  };
}

export type QuantityScope = PlanScopeKind;

export interface QuantityOptions {
  levelId?: string;
  standardFloorGroupId?: string;
  scope?: QuantityScope;
  measurementStandard?: MeasurementStandardId;
}

export interface ComplianceItem {
  id: string;
  title: string;
  status: "success" | "warning";
  message: string;
  basis: string;
  levelId?: string;
  levelName?: string;
  ruleId?: string;
  code?: string;
  severity?: ComplianceSeverity;
  scope?: ComplianceScope;
  affectedFloorIds?: string[];
  fixActionId?: CopilotActionId;
}

function toComplianceItem(result: ComplianceResult): ComplianceItem {
  return {
    id: result.id,
    ruleId: result.ruleId,
    code: result.code,
    title: result.title,
    status: result.status,
    message: result.message,
    basis: result.basis,
    levelId: result.levelId,
    levelName: result.levelName,
    severity: result.severity,
    scope: result.scope,
    affectedFloorIds: result.affectedFloorIds,
    fixActionId: result.fixActionId
  };
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function polygonPerimeter(points: Point[]) {
  return points.reduce((total, point, index) => total + distance(point, points[(index + 1) % points.length]), 0);
}

function wallLength(wall: Wall) {
  return distance(wall.start, wall.end);
}

function polygonArea(points: Point[]) {
  const area = points.reduce((total, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length];
    return total + x * nextY - nextX * y;
  }, 0);

  return Math.abs(area) / 2;
}

function resolveQuantityScope(version: PlanVersion, options: QuantityOptions): QuantityScope {
  return resolvePlanScope(version, options).scope;
}

function roomsForQuantities(version: PlanVersion, options: QuantityOptions, scope: QuantityScope) {
  return resolvePlanScope(version, { ...options, scope }).rooms;
}

function wallsForQuantities(version: PlanVersion, options: QuantityOptions, scope: QuantityScope) {
  return resolvePlanScope(version, { ...options, scope }).walls;
}

function openingsForQuantities(version: PlanVersion, options: QuantityOptions, scope: QuantityScope) {
  return resolvePlanScope(version, { ...options, scope }).openings;
}

function outlineForQuantities(version: PlanVersion, options: QuantityOptions, scope: QuantityScope) {
  return resolvePlanScope(version, { ...options, scope }).outline;
}

function roomOpenings(room: Room, openings: OpeningElement[], type: OpeningElement["type"]) {
  return openings.filter((opening) => opening.type === type && opening.roomIds?.includes(room.id));
}

function classifyRow(rowId: string, standardId: MeasurementStandardId) {
  return resolveMeasurementRuleSet(standardId).classify(rowId);
}

function buildQuantityResult(
  rooms: Room[],
  walls: Wall[],
  openings: OpeningElement[],
  outline: Point[],
  slabAreaBasis: string,
  roofAreaBasis: string,
  slabAreaOverride?: number,
  roofAreaOverride?: number,
  measurementStandard: MeasurementStandardId = "gb50300",
  structural?: StructuralQuantitySummary
): QuantityResult {
  const grossArea = rooms.reduce((total, room) => total + room.areaSqm, 0);
  const netUsableArea = rooms
    .filter((room) => room.zone !== "circulation" && room.type !== "shaft")
    .reduce((total, room) => total + room.areaSqm, 0);
  const outlineArea = polygonArea(outline);
  const externalWallLength = walls.length
    ? walls
        .filter((wall) => wall.type === "external")
        .reduce((total, wall) => total + wallLength(wall), 0)
    : polygonPerimeter(outline);
  const roomPerimeterTotal = rooms.reduce((total, room) => total + polygonPerimeter(room.polygon), 0);
  const internalWallLength = walls.length
    ? walls
        .filter((wall) => wall.type === "internal" || wall.type === "partition" || wall.type === "core")
        .reduce((total, wall) => total + wallLength(wall), 0)
    : Math.max(0, (roomPerimeterTotal - externalWallLength) / 2);
  const averageWallHeight =
    rooms.reduce((total, room) => total + room.ceilingHeight, 0) / Math.max(1, rooms.length);
  const wallBreakdown = walls.length
    ? computeWallAreaWithOpeningDeductions(walls, openings)
    : {
        grossWallArea: (externalWallLength + internalWallLength) * averageWallHeight,
        openingDeductionArea: openings.reduce((total, opening) => total + opening.width * opening.height, 0),
        netWallArea: 0,
        openingsByWall: {}
      };
  if (!walls.length) {
    wallBreakdown.netWallArea = Math.max(0, wallBreakdown.grossWallArea - wallBreakdown.openingDeductionArea);
  }
  const wallArea = wallBreakdown.netWallArea;
  const doorCount = openings.length
    ? openings.filter((opening) => opening.type === "door").length
    : rooms.reduce((total, room) => total + room.doors.length, 0);
  const windowCount = openings.length
    ? openings.filter((opening) => opening.type === "window").length
    : rooms.reduce((total, room) => total + room.windows.length, 0);
  const slabArea = slabAreaOverride ?? (outlineArea || grossArea);
  const roofArea = roofAreaOverride ?? slabArea;
  const curtainWallOrWindowArea = openings.length
    ? openings
        .filter((opening) => opening.type === "window")
        .reduce((total, opening) => total + opening.width * opening.height, 0)
    : rooms.reduce(
        (total, room) => total + room.windows.reduce((windowTotal, opening) => windowTotal + opening.width * 1.8, 0),
        0
      );

  const areaByZone = rooms.reduce(
    (acc, room) => {
      acc[room.zone] += room.areaSqm;
      return acc;
    },
    {
      public: 0,
      semi_public: 0,
      private: 0,
      service: 0,
      circulation: 0
    } satisfies Record<FunctionZone, number>
  );

  const areaByRoomType = rooms.reduce<Partial<Record<RoomType, number>>>((acc, room) => {
    acc[room.type] = (acc[room.type] ?? 0) + room.areaSqm;
    return acc;
  }, {});

  const rows: QuantityRow[] = [
    {
      id: "gross-area",
      label: "Gross building area",
      value: grossArea,
      unit: "sqm",
      basis: "Sum of Room.areaSqm",
      classification: classifyRow("gross-area", measurementStandard)
    },
    {
      id: "net-area",
      label: "Net usable area",
      value: netUsableArea,
      unit: "sqm",
      basis: "Rooms excluding circulation and shafts"
    },
    {
      id: "external-wall-length",
      label: "External wall length",
      value: externalWallLength,
      unit: "m",
      basis: walls.length ? "Sum of Level.walls where type = external" : "Perimeter of PlanVersion.outline"
    },
    {
      id: "internal-wall-length",
      label: walls.length ? "Internal wall length" : "Internal wall length estimate",
      value: internalWallLength,
      unit: "m",
      basis: walls.length
        ? "Sum of Level.walls where type = internal, partition or core"
        : "(Sum room perimeters - outline perimeter) / 2"
    },
    {
      id: "wall-area-gross",
      label: walls.length ? "Wall area (gross)" : "Wall area estimate (gross)",
      value: wallBreakdown.grossWallArea,
      unit: "sqm",
      basis: walls.length ? "Sum of wall length × wall height" : "(External + internal wall length) × average ceiling height",
      classification: classifyRow("wall-area-gross", measurementStandard)
    },
    {
      id: "opening-deduction",
      label: "Opening deductions",
      value: wallBreakdown.openingDeductionArea,
      unit: "sqm",
      basis: openings.length
        ? "Sum of OpeningElement width × height on assigned walls"
        : "Estimated from room door/window schedules",
      classification: classifyRow("opening-deduction", measurementStandard)
    },
    {
      id: "wall-area-net",
      label: walls.length ? "Wall area (net)" : "Wall area estimate (net)",
      value: wallArea,
      unit: "sqm",
      basis: "Gross wall area minus opening deductions",
      classification: classifyRow("wall-area-net", measurementStandard)
    },
    {
      id: "doors",
      label: "Door count",
      value: doorCount,
      unit: "pcs",
      basis: openings.length ? "Level.openings where type = door" : "Sum of room.doors"
    },
    {
      id: "windows",
      label: "Window count",
      value: windowCount,
      unit: "pcs",
      basis: openings.length ? "Level.openings where type = window" : "Sum of room.windows"
    },
    { id: "slab-area", label: "Floor slab area", value: slabArea, unit: "sqm", basis: slabAreaBasis },
    { id: "roof-area", label: "Roof area", value: roofArea, unit: "sqm", basis: roofAreaBasis },
    {
      id: "curtain-window-area",
      label: "Curtain wall / window area estimate",
      value: curtainWallOrWindowArea,
      unit: "sqm",
      basis: openings.length ? "Window OpeningElement width * height" : "Window width * 1.8m typical height"
    },
    ...(structural
      ? [
          {
            id: "concrete-volume",
            label: "Structural concrete volume",
            value: structural.totalConcreteM3,
            unit: "m³",
            basis: "Columns + beams + slabs + stairs + shear walls",
            classification: classifyRow("concrete-volume", measurementStandard)
          },
          {
            id: "rebar-weight",
            label: "Rebar weight estimate",
            value: structural.rebarWeightKg,
            unit: "kg",
            basis: `${structural.totalConcreteM3} m³ × 85 kg/m³ indicative ratio`,
            classification: classifyRow("rebar-weight", measurementStandard)
          },
          {
            id: "slab-concrete",
            label: "Slab concrete",
            value: structural.slabConcreteM3,
            unit: "m³",
            basis: `${structural.slabAreaSqm} sqm × 150mm typical thickness`,
            classification: classifyRow("slab-concrete", measurementStandard)
          },
          {
            id: "stair-concrete",
            label: "Stair concrete",
            value: structural.stairConcreteM3,
            unit: "m³",
            basis: `${structural.stairCount} stair core(s) × 12 m³ allowance`,
            classification: classifyRow("stair-concrete", measurementStandard)
          }
        ]
      : [])
  ].map((row) => ({ ...row, value: round(row.value) }));

  return {
    rows,
    areaByZone,
    areaByRoomType,
    summary: {
      grossArea: round(grossArea),
      netUsableArea: round(netUsableArea),
      externalWallLength: round(externalWallLength),
      internalWallLength: round(internalWallLength),
      wallArea: round(wallArea),
      wallAreaGross: round(wallBreakdown.grossWallArea),
      wallAreaNet: round(wallArea),
      openingDeductionArea: round(wallBreakdown.openingDeductionArea),
      doorCount,
      windowCount,
      slabArea: round(slabArea),
      roofArea: round(roofArea),
      curtainWallOrWindowArea: round(curtainWallOrWindowArea),
      structural
    }
  };
}

export function calculateQuantities(
  version: PlanVersion,
  levelIdOrOptions?: string | QuantityOptions
): QuantityResult {
  const options: QuantityOptions =
    typeof levelIdOrOptions === "string" ? { levelId: levelIdOrOptions } : (levelIdOrOptions ?? {});
  const scope = resolveQuantityScope(version, options);
  const rooms = roomsForQuantities(version, options, scope);
  const walls = wallsForQuantities(version, options, scope);
  const openings = openingsForQuantities(version, options, scope);
  const outline = outlineForQuantities(version, options, scope);
  const outlineArea = polygonArea(outline);
  const topLevel = version.levels[version.levels.length - 1];
  const groups = version.standardFloorGroups;
  const measurementStandard = options.measurementStandard ?? "gb50300";
  const structural = scope === "building" ? estimateStructuralQuantities(version) : undefined;

  if (scope === "building") {
    const perLevelSlab = version.levels.reduce((total, level) => {
      const levelOutline = resolveLevelOutline(level, groups, version.outline);
      const levelRooms = resolveLevelRooms(level, groups);
      const levelGross = levelRooms.reduce((sum, room) => sum + room.areaSqm, 0);
      return total + (polygonArea(levelOutline) || levelGross);
    }, 0);
    const topResolved = topLevel ? resolveLevelRooms(topLevel, groups) : [];
    const roofOutline = topLevel ? resolveLevelOutline(topLevel, groups, version.outline) : version.outline;
    const roofGross = topResolved.reduce((sum, room) => sum + room.areaSqm, 0);

    return buildQuantityResult(
      rooms,
      walls,
      openings,
      outline,
      "Sum of per-level slab areas",
      "Top level outline area",
      perLevelSlab || outlineArea * Math.max(1, version.levels.length),
      polygonArea(roofOutline) || roofGross || outlineArea,
      measurementStandard,
      structural
    );
  }

  return buildQuantityResult(
    rooms,
    walls,
    openings,
    outline,
    "Level outline polygon area",
    scope === "floor_group" ? "Assume roof equals standard-floor-group outline" : "Assume roof equals level outline area",
    undefined,
    undefined,
    measurementStandard,
    structural
  );
}

export function calculateQuantitiesByFloorGroup(version: PlanVersion): Record<string, QuantityResult> {
  const groups = version.standardFloorGroups ?? [];

  return groups.reduce<Record<string, QuantityResult>>((acc, group) => {
    acc[group.id] = calculateQuantities(version, { standardFloorGroupId: group.id, scope: "floor_group" });
    return acc;
  }, {});
}

export function calculateQuantitiesByLevel(version: PlanVersion): Record<string, QuantityResult> {
  return version.levels.reduce<Record<string, QuantityResult>>((acc, level) => {
    acc[level.id] = calculateQuantities(version, { levelId: level.id, scope: "level" });
    return acc;
  }, {});
}

export function checkCompliance(
  version: PlanVersion,
  codeContext: CodeContext = resolveCodeContextFromTypology(),
  rulePack: RulePack = resolveRulePack({ codeContext }),
  options: { buildingType?: string; scoringConfig?: ScoringConfig } = {}
): ComplianceItem[] {
  const ctx = buildComplianceContext(version, rulePack, {
    buildingType: options.buildingType ?? "healthcare",
    scoringConfig: options.scoringConfig
  });

  return runComplianceCheck(ctx).map(toComplianceItem);
}
