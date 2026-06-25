import type { PlanVersion } from "@/lib/project-types";
import type { PlanImportSource } from "@/lib/plan-import/types";

export interface AnalyzePlanClientResult {
  version: PlanVersion;
  fileName: string;
  warnings?: string[];
  confidence?: number;
  importPath?: "vision" | "structured";
  sourceType?: string;
}

export async function analyzePlanFromUpload(input: {
  fileBase64: string;
  fileName: string;
  sourceType: PlanImportSource;
}): Promise<AnalyzePlanClientResult> {
  const response = await fetch("/api/analyze-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileBase64: input.fileBase64,
      fileName: input.fileName,
      sourceType: input.sourceType
    })
  });

  if (!response.ok) {
    throw new Error(`analyze-plan failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    version?: PlanVersion;
    warnings?: string[];
    confidence?: number;
    importPath?: "vision" | "structured";
    sourceType?: string;
  };

  if (!data.version?.rooms) {
    throw new Error("analyze-plan did not return a complete PlanVersion.");
  }

  return {
    version: data.version,
    fileName: input.fileName,
    warnings: data.warnings,
    confidence: data.confidence,
    importPath: data.importPath,
    sourceType: data.sourceType
  };
}
