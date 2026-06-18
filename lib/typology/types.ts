import type { ProgramSpaceRequirement, ProgramAdjacencyRule } from "@/lib/building-domain";
import type { AnalysisLayer, AnalysisLayerId, DesignBrief, RoomType } from "@/lib/project-types";
import type { ProgramGoals, RulePack } from "@/lib/rules/types";

export type TypologyPackId = "healthcare" | "office" | "residential" | "school";

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
}
