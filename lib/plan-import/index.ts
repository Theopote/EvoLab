import { decodeBase64File } from "@/lib/plan-import/file-input";
import { parseDxfToGraph } from "@/lib/plan-import/dxf-import";
import { importPlanFromImage } from "@/lib/plan-import/image-recognition";
import { parsePdfToGraph, renderPdfPageToImage, shouldFallbackPdfToVision } from "@/lib/plan-import/pdf-import";
import { buildPlanVersionFromGraph, estimateGraphConfidence } from "@/lib/plan-import/graph-to-version";
import type { PlanImportResult, PlanImportSource } from "@/lib/plan-import/types";
import { detectImportSource } from "@/lib/plan-import/detect-source";
import { normalizeImageInput } from "@/lib/image-input";
import { postProcessPlanVersion } from "@/lib/plan-postprocess";

interface ImportPlanOptions {
  fileBase64?: string;
  imageBase64?: string;
  fileName?: string;
  sourceType?: PlanImportSource;
}

function buildStructuredResult(
  graph: Parameters<typeof buildPlanVersionFromGraph>[0],
  sourceType: PlanImportSource,
  fileName?: string,
  extraWarnings: string[] = []
): PlanImportResult {
  const draft = buildPlanVersionFromGraph(graph, {
    fileName,
    label: fileName ? `CAD Import / ${fileName}` : "CAD Import"
  });

  return {
    version: postProcessPlanVersion(draft),
    confidence: estimateGraphConfidence(graph),
    warnings: [...graph.warnings, ...extraWarnings],
    sourceType,
    importPath: "structured"
  };
}

export async function importPlan(options: ImportPlanOptions): Promise<PlanImportResult> {
  const payload = options.fileBase64 ?? options.imageBase64;
  const sourceType = detectImportSource(options.fileName, options.sourceType);

  if (sourceType === "image") {
    const image = normalizeImageInput(payload, options.fileName);

    if (!image) {
      throw new Error("imageBase64 or fileBase64 is required for image import.");
    }

    return importPlanFromImage(image, options.fileName);
  }

  const buffer = decodeBase64File(payload);

  if (!buffer) {
    throw new Error("fileBase64 is required for structured import.");
  }

  if (sourceType === "dxf") {
    const graph = parseDxfToGraph(buffer.toString("utf8"));
    return buildStructuredResult(graph, "dxf", options.fileName);
  }

  const graph = await parsePdfToGraph(buffer);

  if (shouldFallbackPdfToVision(graph)) {
    const renderedImage = await renderPdfPageToImage(buffer);
    const result = await importPlanFromImage(renderedImage, options.fileName);

    return {
      ...result,
      sourceType: "pdf",
      warnings: [
        ...result.warnings,
        "PDF text layer was sparse, so EvoLab rendered page 1 and used visual recognition."
      ]
    };
  }

  return buildStructuredResult(graph, "pdf", options.fileName);
}

export { detectImportSource } from "@/lib/plan-import/detect-source";
export type { PlanImportResult, PlanImportSource } from "@/lib/plan-import/types";
