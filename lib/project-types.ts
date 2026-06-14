export interface ProjectData {
  projectId: string;
  projectName: string;
  projectType: string;
  versions: PlanVersion[];
  activeVersionId: string;
}

export const workspaceTabs = [
  "Plan",
  "Massing",
  "Model",
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

export interface PlanVersion {
  id: string;
  label: string;
  createdAt: string;
  parentVersionId?: string;
  rooms: Room[];
  outline: Point[];
  overallBounds: {
    width: number;
    height: number;
  };
  scores?: VersionScores;
  mep?: MepLayout;
}

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  zone: FunctionZone;
  polygon: Point[];
  areaSqm: number;
  ceilingHeight: number;
  orientation?: string;
  doors: Opening[];
  windows: Opening[];
  needsDaylight?: boolean;
  needsPlumbing?: boolean;
  adjacents?: string[];
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

export interface Opening {
  wall: "north" | "south" | "east" | "west";
  position: number;
  width: number;
}

export type Point = [number, number];

export interface VersionScores {
  areaEfficiency: number;
  circulationScore: number;
  daylightScore: number;
  mepAlignmentScore: number;
  riskCount: number;
}

export interface MepLayout {
  shafts: MepShaft[];
  routes: MepRoute[];
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
  | "patient_flow"
  | "staff_flow"
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
