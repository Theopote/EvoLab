import type { PlanVersion } from "@/lib/project-types";
import type { PlanImportResult, PlanImportSource } from "@/lib/plan-import/types";

export interface AnalyzePlanClientInput {
  fileBase64: string;
  fileName: string;
  sourceType: PlanImportSource;
  pdfPageNumber?: number;
}

export interface AnalyzePlanClientResult extends PlanImportResult {
  fallback?: boolean;
}

export async function analyzePlanDrawing(input: AnalyzePlanClientInput): Promise<AnalyzePlanClientResult> {
  const response = await fetch("/api/analyze-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64: input.fileBase64,
      fileName: input.fileName,
      sourceType: input.sourceType,
      pdfPageNumber: input.pdfPageNumber
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `analyze-plan failed with ${response.status}`);
  }

  const data = (await response.json()) as {
    version?: PlanVersion;
    confidence?: number;
    warnings?: string[];
    sourceType?: PlanImportSource;
    importPath?: "vision" | "structured";
    fallback?: boolean;
  };

  if (!data.version?.rooms) {
    throw new Error("analyze-plan did not return a complete PlanVersion.");
  }

  return {
    version: data.version,
    confidence: data.confidence ?? 0,
    warnings: data.warnings ?? [],
    sourceType: data.sourceType ?? input.sourceType,
    importPath: data.importPath ?? (input.sourceType === "image" ? "vision" : "structured"),
    fallback: data.fallback
  };
}
