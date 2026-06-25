import type { AnalysisLayerId, MepLayerId } from "@/lib/project-types";
import type { CompareLensDefinition, CompareLensId } from "@/lib/compare/types";

export const compareLensDefinitions: CompareLensDefinition[] = [
  { id: "plan", label: "Plan", description: "Floor plan read" },
  { id: "area", label: "Area", description: "Functional zones and net/gross read" },
  { id: "flow", label: "Flow", description: "Primary, staff, and service circulation" },
  { id: "daylight", label: "Daylight", description: "Daylight exposure probes" },
  { id: "structure", label: "Structure", description: "Columns, beams, and shear walls" },
  { id: "furniture", label: "Furniture", description: "Furniture placement overlay" },
  { id: "systems", label: "Systems", description: "Concept MEP routing" },
  { id: "diff", label: "Diff", description: "Geometry changes between pinned schemes", requiresPair: true }
];

export function analysisLayersForCompareLens(lens: CompareLensId): AnalysisLayerId[] {
  switch (lens) {
    case "area":
      return ["function_zones"];
    case "flow":
      return ["primary_flow", "staff_flow", "service_flow"];
    case "daylight":
      return ["daylight"];
    default:
      return [];
  }
}

export function mepLayersForCompareLens(): MepLayerId[] {
  return ["hvac", "plumbing_supply", "plumbing_drain", "electrical", "shafts"];
}

export function usesAnalysisEngine(lens: CompareLensId) {
  return lens === "area" || lens === "flow" || lens === "daylight";
}
