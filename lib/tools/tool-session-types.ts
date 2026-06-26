import type { PlanVersion } from "@/lib/project-types";
import type { ToolDefinition } from "@/lib/tools/tool-definitions";

export type ToolSessionStatus = "draft" | "ready" | "promoted";

export interface ToolSessionInputFile {
  fileName: string;
  sourceType: string;
}

export interface ToolSessionAnalysisMeta {
  confidence: number;
  importPath: "vision" | "structured";
  sourceType: string;
  warnings: string[];
  fallback?: boolean;
}

export interface ToolSessionOutput {
  kind: "plan-version";
  planVersion: PlanVersion;
  sourcePlanVersion?: PlanVersion;
  referencePreviewUrl?: string;
}

export interface ToolSession {
  id: string;
  toolId: ToolDefinition["id"];
  title: string;
  inputFiles?: ToolSessionInputFile[];
  parameters?: Record<string, string | number | boolean>;
  outputs?: ToolSessionOutput;
  analysisMeta?: ToolSessionAnalysisMeta;
  createdAt: string;
  updatedAt: string;
  canPromoteToProject: boolean;
  linkedProjectId?: string;
  status: ToolSessionStatus;
}

export type ToolSessionMap = Record<string, ToolSession>;

export interface ToolSessionSummary {
  id: string;
  toolId: ToolSession["toolId"];
  title: string;
  status: ToolSessionStatus;
  updatedAt: string;
}
