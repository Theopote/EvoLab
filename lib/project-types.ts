import type { ProjectDomain } from "@/lib/building-domain";

export interface ProjectData {
  projectId: string;
  projectName: string;
  projectType: string;
  versions: PlanVersion[];
  activeVersionId: string;
  domain: ProjectDomain;
}

export const workspaceTabs = [
  "Plan",
  "Massing",
  "Model",
  "Structure",
  "Facade",
  "Furniture",
  "Analysis",
  "Systems",
  "Quantity",
  "Render",
  "Sheets",
  "Export"
] as const;

export type WorkspaceTab = (typeof workspaceTabs)[number];

export interface DesignBrief {
  projectType: string;
  description: string;
  floors: number;
  targetArea: number;
  corePreference: string;
  orientationPreference: string;
}

/** Shared layout for standard (typical) floors — the group is the source of truth. */
export interface StandardFloorGroup {
  id: string;
  label?: string;
  rooms: Room[];
  outline: Point[];
  memberFloorIds: string[];
}

export interface PlanVersion {
  id: string;
  label: string;
  createdAt: string;
  parentVersionId?: string;
  metadata?: PlanVersionMetadata;
  rooms: Room[];
  levels: Level[];
  building: Building;
  outline: Point[];
  overallBounds: {
    width: number;
    height: number;
  };
  scores?: VersionScores;
  mep?: MepLayout;
  /** Typical-floor groups; member levels reference via standardFloorGroupId. */
  standardFloorGroups?: StandardFloorGroup[];
  /** Derived structural vertical constraints used for alignment checks. */
  verticalElements?: VerticalElement[];
}

export type VerticalElementKind = "column" | "shear_wall" | "mep_shaft" | "core";

export interface VerticalElement {
  id: string;
  kind: VerticalElementKind;
  /** Point for columns/shafts; polygon for cores and shear walls. */
  position: Point | Point[];
  appliesFromFloorId: string;
  appliesToFloorId: string;
  label?: string;
}

export type VerticalAlignmentIssueType = "no_containing_room" | "core_type_mismatch";

export interface VerticalAlignmentIssue {
  id: string;
  floorId: string;
  floorName: string;
  elementId: string;
  elementKind: VerticalElementKind;
  type: VerticalAlignmentIssueType;
  message: string;
  position?: Point;
}

export interface TransferFloorHint {
  id: string;
  afterLevelId: string;
  beforeLevelId: string;
  message: string;
}

export interface PlanVersionMetadata {
  strategy?: string;
  topology?: {
    circulation?: string;
    core?: string;
    daylight?: string;
    plumbing?: string;
  };
  floorCount?: number;
  expandedFromSingleFloor?: boolean;
  differentiatedFloors?: boolean;
  floorPrograms?: Array<{ levelIndex: number; program: FloorProgram }>;
  topologyGraph?: TopologyGraph;
  relayoutedAt?: string;
  validationWarnings?: string[];
  repairs?: string[];
  zoningApplied?: boolean;
  envelopeCompliant?: boolean;
  pipelinePhases?: {
    topology: boolean;
    geometry: boolean;
    refinement: boolean;
  };
  refinementSummary?: string;
  programCompliant?: boolean;
  programValidationWarnings?: string[];
  hybridSourceVersionIds?: string[];
}

export interface TopologyGraphRoom {
  id: string;
  name: string;
  type: RoomType;
  zone: FunctionZone;
  targetAreaSqm: number;
  ceilingHeight?: number;
  needsDaylight?: boolean;
  needsPlumbing?: boolean;
  preferredEdge?: "north" | "south" | "east" | "west" | "interior";
  adjacencyIds?: string[];
}

export interface TopologyGraphEdge {
  from: string;
  to: string;
  relationship: "direct" | "near" | "separated";
}

export interface TopologyGraph {
  id: string;
  label: string;
  strategy: string;
  topology: NonNullable<PlanVersionMetadata["topology"]> & {
    circulation: string;
    core: string;
    daylight: string;
    plumbing: string;
  };
  rooms: TopologyGraphRoom[];
  edges: TopologyGraphEdge[];
}

export interface RoomProtrusion {
  id: string;
  type: "bay_window" | "niche" | "balcony";
  footprint: Point[];
  depthM: number;
  widthM?: number;
  sillHeightM?: number;
  headroomM?: number;
  positionOnEdge?: number;
  centerOnWall?: Point;
  gfaExempt?: boolean;
  gfaExemptBasis?: string;
}

export interface Room {
  id: string;
  levelId?: string;
  name: string;
  type: RoomType;
  zone: FunctionZone;
  polygon: Point[];
  wallIds?: string[];
  openingIds?: string[];
  areaSqm: number;
  ceilingHeight: number;
  orientation?: string;
  doors: Opening[];
  windows: Opening[];
  needsDaylight?: boolean;
  needsPlumbing?: boolean;
  adjacents?: string[];
  protrusions?: RoomProtrusion[];
}

export type RoomType =
  | "lobby"
  | "corridor"
  | "consultation"
  | "ward"
  | "office"
  | "living_room"
  | "bedroom"
  | "kitchen"
  | "bathroom"
  | "stair"
  | "elevator"
  | "shaft"
  | "equipment_room"
  | "other";

export type FunctionZone =
  | "public"
  | "semi_public"
  | "private"
  | "service"
  | "circulation";

export interface Building {
  id: string;
  name: string;
  boundary: Boundary;
  levels: Level[];
  floors: Floor[];
  cores: Core[];
  grids: Grid[];
}

export type FloorProgram = "ground" | "typical" | "top";

export type LevelType = "ground" | "typical" | "top";

export interface Level {
  id: string;
  name: string;
  elevation: number;
  height: number;
  /** Sort key for elevation computation; B1 = -1, 1F = 1. Defaults from level order. */
  floorNumber?: number;
  levelType?: LevelType;
  floorProgram?: FloorProgram;
  /** When set, rooms/outline resolve from the matching StandardFloorGroup. */
  standardFloorGroupId?: string;
  /** Populated when a level is detached from a standard-floor group. */
  localOverrideRooms?: Room[];
  /** Marks a transfer floor where vertical structure may change. */
  isTransferFloor?: boolean;
  rooms: Room[];
  walls: Wall[];
  openings: OpeningElement[];
  floor?: Floor;
  boundary?: Boundary;
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number;
  height: number;
  type: "external" | "internal" | "core" | "partition";
  roomIds: string[];
}

export interface OpeningElement {
  id: string;
  wallId: string;
  wallEdgeId?: string;
  positionOnEdge?: number;
  type: "door" | "window" | "opening";
  center: Point;
  width: number;
  height: number;
  sillHeight?: number;
  roomIds?: string[];
}

export interface Boundary {
  id: string;
  polygon: Point[];
  type: "site" | "building" | "level";
}

export interface Core {
  id: string;
  levelIds: string[];
  roomIds: string[];
  wallIds: string[];
  type: "stair" | "elevator" | "shaft" | "mixed";
}

export interface Grid {
  id: string;
  name: string;
  lines: GridLine[];
}

export interface GridLine {
  id: string;
  label: string;
  start: Point;
  end: Point;
  axis: "x" | "y" | "custom";
}

export interface Floor {
  id: string;
  levelId: string;
  outline: Point[];
  thickness: number;
  elevation: number;
}

export interface Element {
  id: string;
  levelId: string;
  category: "wall" | "opening" | "floor" | "core" | "grid" | "boundary" | "room";
  name?: string;
}

export interface Opening {
  wall: "north" | "south" | "east" | "west";
  position: number;
  width: number;
}

export type Point = [number, number];

export interface ScoreMetricEvidence {
  label: string;
  value: string;
  impact?: "positive" | "negative" | "neutral";
}

export interface ScoreMetricContribution {
  id: string;
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  summary: string;
  evidence: ScoreMetricEvidence[];
}

export interface ScoreBreakdown {
  rulePackId: string;
  programGoalsId: string;
  totalScore: number;
  metrics: ScoreMetricContribution[];
  comparisonHints: string[];
}

export interface VersionScores {
  areaEfficiency: number;
  circulationScore: number;
  daylightScore: number;
  mepAlignmentScore: number;
  egressScore?: number;
  structureFitScore?: number;
  riskCount: number;
  breakdown?: ScoreBreakdown;
}

export interface MepLayout {
  shafts: MepShaft[];
  routes: MepRoute[];
  strategy?: MepStrategy;
}

export interface MepStrategy {
  systemConcept: string;
  shaftLogic: string;
  routingLogic: string;
  assumptions: string[];
}

export interface MepShaft {
  id: string;
  position: Point;
  systems: MepSystemType[];
}

export interface MepRoute {
  id: string;
  system: MepSystemType;
  path: Point[];
  connectsRoomIds: string[];
}

export type MepSystemType =
  | "hvac"
  | "plumbing_supply"
  | "plumbing_drain"
  | "electrical"
  | "elv"
  | "fire";

export type MepLayerId = MepSystemType | "shafts" | "equipment_rooms";

export type AnalysisLayerId =
  | "function_zones"
  | "primary_flow"
  | "patient_flow"
  | "staff_flow"
  | "service_flow"
  | "clean_dirty_flow"
  | "egress_path"
  | "egress_distance"
  | "daylight"
  | "ventilation"
  | "sightline"
  | "core_efficiency";

export interface AnalysisLayer {
  id: AnalysisLayerId;
  label: string;
  category: "function" | "environment" | "safety" | "efficiency";
}

export type CopilotActionId =
  | "optimize-egress"
  | "apply-compliance-fix"
  | "generate-flow-diagram"
  | "layout-shafts"
  | "generate-massing"
  | "recalculate-areas"
  | "select-room"
  | "switch-tab"
  | "select-version"
  | "regenerate-plan";

export interface CopilotAction {
  id: CopilotActionId;
  label: string;
  payload?: string;
}

export interface CopilotFinding {
  id: string;
  tone: "info" | "warning" | "success";
  text: string;
  sub?: string;
  actions?: CopilotAction[];
}

export type CopilotMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string }
  | { id: string; role: "findings"; title: string; items: CopilotFinding[] };
