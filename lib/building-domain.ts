import type { Point, PlanVersion, RoomType, FunctionZone, CopilotFinding } from "@/lib/project-types";
import type { CopilotInsightQueue } from "@/lib/copilot-insight-queue";
import type { DesignDecision } from "@/lib/design-decision-log";
import type { PlanChangeProposal } from "@/lib/schemas/plan-change-proposal-schema";
import type { SiteContext, ZoningConstraints } from "@/lib/site-types";

export type ChangeSource = "ai" | "user" | "import" | "system";
export type ChangeStatus = "draft" | "approved" | "rejected" | "applied";
export type ProgramPriority = "required" | "preferred" | "optional";
export type CodeRuleCategory =
  | "egress"
  | "daylight"
  | "circulation"
  | "plumbing"
  | "core"
  | "accessibility"
  | "parking";

export interface SiteModel {
  id: string;
  name: string;
  outline: Point[];
  orientationDeg: number;
  zoning: ZoningConstraints;
  context?: SiteContext;
  redLineNotes?: string;
}

export interface CodeRule {
  id: string;
  category: CodeRuleCategory;
  title: string;
  basis: string;
  threshold?: number;
  unit?: string;
  comparator?: "lte" | "gte" | "eq";
}

export interface CodeContext {
  id: string;
  label: string;
  region?: string;
  rules: CodeRule[];
}

export type RulePackPresetId = "healthcare" | "office" | "residential" | "school";
export type ProgramGoalsPresetId = "healthcare" | "office" | "residential" | "school" | "balanced";

export interface ScoringConfigThresholds {
  circulationTargetRatio?: number;
  circulationTolerance?: number;
  plumbingMaxDistanceM?: number;
  egressMaxDistanceM?: number;
  daylightMaxDepthM?: number;
  areaEfficiencyFactor?: number;
}

export interface ScoringConfigGoalWeights {
  areaEfficiency?: number;
  circulation?: number;
  daylight?: number;
  wetCore?: number;
  egress?: number;
  structureFit?: number;
  riskPenalty?: number;
}

export interface ScoringConfig {
  rulePackPreset?: RulePackPresetId;
  programGoalsPreset?: ProgramGoalsPresetId;
  scoringThresholds?: ScoringConfigThresholds;
  goalWeights?: ScoringConfigGoalWeights;
  ruleThresholds?: {
    "corridor-width"?: number;
    "egress-distance"?: number;
    "stair-count"?: number;
  };
  gfaExemption?: {
    bayWindow?: {
      maxDepthM?: number;
      minSillHeightM?: number;
      minHeadroomM?: number;
      notice?: string;
    };
  };
  egressWidth?: {
    widthPer100PersonsM?: number;
    areaPerOccupantSqm?: number;
    notice?: string;
  };
}

export interface ProgramAdjacencyRule {
  spaceId: string;
  targetSpaceId?: string;
  targetRoomType?: RoomType;
  relationship: "must" | "must_not" | "prefer";
}

export interface ProgramSpaceRequirement {
  id: string;
  name: string;
  roomType: RoomType;
  zone: FunctionZone;
  minAreaSqm?: number;
  maxAreaSqm?: number;
  targetAreaSqm?: number;
  priority: ProgramPriority;
  count?: number;
  needsDaylight?: boolean;
  needsPlumbing?: boolean;
  adjacencyRules?: ProgramAdjacencyRule[];
}

export interface ProgramModel {
  id: string;
  label: string;
  projectType: string;
  targetGrossAreaSqm?: number;
  floorCount?: number;
  spaces: ProgramSpaceRequirement[];
  notes?: string;
}

export interface StoreyGroup {
  id: string;
  label: string;
  levelIds: string[];
  typicalLevelId?: string;
  floorProgram?: string;
}

export interface StoreyRelation {
  id: string;
  fromLevelId: string;
  toLevelId: string;
  relation: "stacked" | "mezzanine" | "double_height" | "setback";
}

export interface StoreyStack {
  id: string;
  levelIds: string[];
  groups: StoreyGroup[];
  relations: StoreyRelation[];
  totalHeightMeters: number;
}

export interface StructuralColumn {
  id: string;
  levelId: string;
  position: Point;
  width: number;
  depth: number;
}

export interface StructuralBeam {
  id: string;
  levelId: string;
  start: Point;
  end: Point;
  depth: number;
}

export interface StructuralShearWall {
  id: string;
  levelId: string;
  start: Point;
  end: Point;
  thickness: number;
}

export interface StructuralSystem {
  id: string;
  gridSpacingMeters: number;
  maxSpanMeters: number;
  columns: StructuralColumn[];
  beams: StructuralBeam[];
  shearWalls: StructuralShearWall[];
}

export interface FacadeZone {
  id: string;
  levelId?: string;
  edge: "north" | "south" | "east" | "west";
  strategy: "curtain_wall" | "punched_window" | "solid" | "mixed";
  targetWindowRatio?: number;
}

export interface FacadeEnvelope {
  id: string;
  zones: FacadeZone[];
  defaultWindowRatio: number;
  orientationStrategy?: string;
}

export type FurnitureCategory = "desk" | "chair" | "bed" | "table" | "sofa" | "equipment";

export interface FurnitureItem {
  id: string;
  roomId: string;
  levelId: string;
  name: string;
  category: FurnitureCategory;
  position: Point;
  rotationDeg: number;
  width: number;
  depth: number;
}

export interface FurnitureLayout {
  id: string;
  versionId: string;
  items: FurnitureItem[];
  generatedAt: string;
}

export interface StairRun {
  id: string;
  levelId: string;
  widthMeters: number;
  riserCount: number;
  hasLanding: boolean;
}

export interface ElevatorGroup {
  id: string;
  levelIds: string[];
  cabCount: number;
  includesFireElevator: boolean;
  position: Point;
}

export interface VerticalCirculationSystem {
  id: string;
  stairRuns: StairRun[];
  elevatorGroups: ElevatorGroup[];
  refugeFloorLevelIds: string[];
}

export interface DoorWindowFamily {
  id: string;
  name: string;
  kind: "door" | "window";
  width: number;
  height: number;
  sillHeight?: number;
  swing?: "left" | "right" | "double" | "sliding" | "fixed";
  clearWidth?: number;
  clearHeight?: number;
  fireRating?: string;
}

export interface ScheduleRow {
  id: string;
  values: Record<string, string | number>;
}

export interface ScheduleTable {
  id: string;
  kind: "room" | "door_window" | "area" | "version_compare";
  title: string;
  columns: string[];
  rows: ScheduleRow[];
  versionId: string;
  generatedAt: string;
}

export interface ScheduleBundle {
  versionId: string;
  generatedAt: string;
  tables: ScheduleTable[];
}

export interface ElementChange {
  elementId: string;
  category: "room" | "wall" | "opening" | "floor" | "core" | "grid" | "boundary";
  levelId?: string;
  field?: string;
  changeType: "add" | "update" | "remove";
  before?: unknown;
  after?: unknown;
}

export interface ChangeSet {
  id: string;
  source: ChangeSource;
  status: ChangeStatus;
  summary: string;
  baseVersionId: string;
  targetVersionId?: string;
  changes: ElementChange[];
  lockedElementIds: string[];
  createdAt: string;
  appliedAt?: string;
  reviewedAt?: string;
  baseVersionSnapshot?: PlanVersion;
  proposalId?: string;
  acceptedOperationIds?: string[];
}

export type CopilotProposalStatus = "draft" | "applied" | "dismissed";

export type CopilotProposalAuditAction =
  | "proposed"
  | "accepted"
  | "rejected"
  | "skipped_locked"
  | "commented"
  | "applied"
  | "dismissed";

export interface CopilotProposalComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface CopilotProposalAuditEntry {
  id: string;
  operationId?: string;
  operationLabel?: string;
  action: CopilotProposalAuditAction;
  detail?: string;
  actor: string;
  createdAt: string;
}

export interface StoredCopilotProposal {
  id: string;
  prompt: string;
  status: CopilotProposalStatus;
  baseVersionId: string;
  resultVersionId?: string;
  changeSetId?: string;
  proposal: PlanChangeProposal;
  findings: CopilotFinding[];
  acceptedOperationIds: string[];
  auditLog: CopilotProposalAuditEntry[];
  comments: CopilotProposalComment[];
  createdAt: string;
  reviewedAt?: string;
  warning?: string;
  baseVersionSnapshot?: PlanVersion;
}

export interface ProjectDomain {
  site: SiteModel;
  program: ProgramModel;
  codeContext: CodeContext;
  scoringConfig?: ScoringConfig;
  storeyStack?: StoreyStack;
  structuralSystem?: StructuralSystem;
  facadeEnvelope?: FacadeEnvelope;
  verticalCirculation?: VerticalCirculationSystem;
  furnitureLayout?: FurnitureLayout;
  doorWindowFamilies: DoorWindowFamily[];
  schedules: ScheduleBundle[];
  changeSets: ChangeSet[];
  copilotProposals: StoredCopilotProposal[];
  lockedElementIds: string[];
  designDecisions?: DesignDecision[];
  copilotInsightQueue?: CopilotInsightQueue;
}

export const defaultDoorWindowFamilies: DoorWindowFamily[] = [
  {
    id: "door-single-900",
    name: "Single Door 900",
    kind: "door",
    width: 0.9,
    height: 2.1,
    swing: "right",
    clearWidth: 0.85,
    clearHeight: 2.0
  },
  {
    id: "door-double-1800",
    name: "Double Door 1800",
    kind: "door",
    width: 1.8,
    height: 2.1,
    swing: "double",
    clearWidth: 1.6,
    clearHeight: 2.0
  },
  {
    id: "window-punched-1500",
    name: "Punched Window 1500",
    kind: "window",
    width: 1.5,
    height: 1.5,
    sillHeight: 0.9,
    swing: "fixed"
  }
];

export const defaultHealthcareCodeContext: CodeContext = {
  id: "code-healthcare-generic",
  label: "Healthcare Early Design",
  region: "generic",
  rules: [
    {
      id: "corridor-width",
      category: "circulation",
      title: "Corridor clear width",
      basis: "Corridor clear width should not be less than 1.2m.",
      threshold: 1.2,
      unit: "m",
      comparator: "gte"
    },
    {
      id: "egress-distance",
      category: "egress",
      title: "Egress travel distance",
      basis: "Egress travel distance should not exceed 30m.",
      threshold: 30,
      unit: "m",
      comparator: "lte"
    },
    {
      id: "stair-count",
      category: "core",
      title: "Vertical core count",
      basis: "At least one stair or elevator core should exist.",
      threshold: 1,
      comparator: "gte"
    }
  ]
};
