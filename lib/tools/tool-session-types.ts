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
  /** External preview URL only — never persist inline data: URLs or base64 payloads. */
  previewUrl?: string;
  sizeBytes?: number;
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

/** Full in-memory session, including heavy payloads active during the current browser session. */
export interface ToolSessionDetail {
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

/** @deprecated Use ToolSessionDetail — kept for existing imports. */
export type ToolSession = ToolSessionDetail;

export type ToolSessionMap = Record<string, ToolSessionDetail>;

export interface ToolSessionSummary {
  id: string;
  toolId: ToolSessionDetail["toolId"];
  title: string;
  status: ToolSessionStatus;
  updatedAt: string;
}

/** Lightweight output metadata persisted in localStorage — no base64, decks, or export blobs. */
export interface ToolSessionStoredOutput {
  id: string;
  kind: ToolSessionOutputKind;
  label: string;
  createdAt: string;
  planVersion?: PlanVersion;
  recognizedPlanVersion?: PlanVersion;
  sourcePlanVersion?: PlanVersion;
  referencePreviewUrl?: string;
  fileName?: string;
  mimeType?: string;
  slideCount?: number;
  briefCount?: number;
}

/** localStorage record: summary fields plus lightweight outputs only. */
export interface ToolSessionStoredRecord {
  id: string;
  toolId: ToolSessionDetail["toolId"];
  title: string;
  inputFiles?: ToolSessionInputFile[];
  parameters?: Record<string, string | number | boolean>;
  outputs: ToolSessionStoredOutput[];
  analysisMeta?: ToolSessionAnalysisMeta;
  createdAt: string;
  updatedAt: string;
  canPromoteToProject: boolean;
  linkedProjectId?: string;
  status: ToolSessionStatus;
}

export type ToolSessionStoredMap = Record<string, ToolSessionStoredRecord>;
