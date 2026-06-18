import type { PlanVersion } from "@/lib/project-types";

export type PlanImportSource = "image" | "pdf" | "dxf";

export interface PlanImportResult {
  version: PlanVersion;
  confidence: number;
  warnings: string[];
  sourceType: PlanImportSource;
  importPath: "vision" | "structured";
}
