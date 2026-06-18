import type { ProgramSpaceRequirement, ProgramAdjacencyRule } from "@/lib/building-domain";
import type { AnalysisLayer, AnalysisLayerId, DesignBrief, FunctionZone, RoomType } from "@/lib/project-types";
import type { ProgramGoals, RulePack } from "@/lib/rules/types";

export type TypologyPackId = "healthcare" | "office" | "residential" | "school";

export type TopologyLayoutKind =
  | "central_core"
  | "dual_corridor"
  | "service_spine"
  | "open_plan"
  | "side_core"
  | "classroom_wing"
  | "hub_spine";

export interface TopologyStrategyTemplate {
  id: string;
  label: string;
  layoutKind: TopologyLayoutKind;
  circulation: string;
  core: string;
  daylight: string;
  plumbing: string;
}

export interface TopologyRoomTemplate {
  id: string;
  name: string;
  roomType: RoomType;
  zone: FunctionZone;
  areaShare: number;
  needsDaylight?: boolean;
  needsPlumbing?: boolean;
  preferredEdge?: "north" | "south" | "east" | "west" | "interior";
  adjacencyIds?: string[];
}

export interface TypologyTopologyConfig {
  strategies: TopologyStrategyTemplate[];
  roomTemplates: TopologyRoomTemplate[];
  wetRoomTypes: RoomType[];
  promptGuidance: string;
}

export interface FlowSegmentDef {
  pathId: string;
  fromRoomTypes: RoomType[];
  toRoomTypes: RoomType[];
}

export interface ServiceFlowSplit {
  clean: FlowSegmentDef;
  dirty: FlowSegmentDef;
}

export interface FlowDefinition {
  id: "primary" | "staff" | "service";
  layerId: Extract<AnalysisLayerId, "primary_flow" | "staff_flow" | "service_flow">;
  segments: FlowSegmentDef[];
  serviceSplit?: ServiceFlowSplit;
}

export interface PackAdjacencyRule {
  fromRoomTypes: RoomType[];
  toRoomTypes: RoomType[];
  relationship: ProgramAdjacencyRule["relationship"];
}

export interface ExportPreset {
  id: string;
  label: string;
  includeLayers: AnalysisLayerId[];
  quantityGroupBy: "zone" | "roomType";
}

export interface TypologyPack {
  id: TypologyPackId;
  label: string;
  aliases: string[];
  roomTypes: RoomType[];
  adjacencyRules: PackAdjacencyRule[];
  flowDefinitions: FlowDefinition[];
  analysisLayers: AnalysisLayer[];
  defaultAnalysisLayers: AnalysisLayerId[];
  rulePack: RulePack;
  programGoals: ProgramGoals;
  defaultBrief: Partial<DesignBrief>;
  defaultProgramSpaces: Omit<ProgramSpaceRequirement, "id">[];
  exportPresets: ExportPreset[];
  topology: TypologyTopologyConfig;
}
