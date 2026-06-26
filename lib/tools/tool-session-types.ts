import type { PresentationDeck } from "@/lib/presentation/types";
import type { PlanVersion } from "@/lib/project-types";
import type { ToolDefinition } from "@/lib/tools/tool-definitions";

export type ToolSessionStatus = "draft" | "ready" | "promoted";

export type ToolSessionOutputKind =
  | "plan-version"
  | "presentation-deck"
  | "image-brief"
  | "file-export";

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

interface ToolSessionOutputBase {
  id: string;
  kind: ToolSessionOutputKind;
  label: string;
  createdAt: string;
}

export interface ToolSessionPlanVersionOutput extends ToolSessionOutputBase {
  kind: "plan-version";
  planVersion: PlanVersion;
  /** Original recognition before manual corrections (trace-to-cad reset). */
  recognizedPlanVersion?: PlanVersion;
  /** Source plan before remix / transform. */
  sourcePlanVersion?: PlanVersion;
  referencePreviewUrl?: string;
}

export interface ToolSessionPresentationDeckOutput extends ToolSessionOutputBase {
  kind: "presentation-deck";
  deck: PresentationDeck;
}

export interface ToolSessionImageBriefOutput extends ToolSessionOutputBase {
  kind: "image-brief";
  briefs: string[];
  massingNotes?: string;
}

export interface ToolSessionFileExportOutput extends ToolSessionOutputBase {
  kind: "file-export";
  fileName: string;
  mimeType: string;
  dataUrl?: string;
}

export type ToolSessionOutput =
  | ToolSessionPlanVersionOutput
  | ToolSessionPresentationDeckOutput
  | ToolSessionImageBriefOutput
  | ToolSessionFileExportOutput;

export interface ToolSession {
  id: string;
  toolId: ToolDefinition["id"];
  title: string;
  inputFiles?: ToolSessionInputFile[];
  parameters?: Record<string, string | number | boolean>;
  outputs: ToolSessionOutput[];
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
