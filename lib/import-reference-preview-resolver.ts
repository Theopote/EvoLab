import type { CopilotPinnedFile } from "@/lib/copilot-upload";
import type { AnalyzePlanClientResult } from "@/lib/plan-import/analyze-plan-client";
import { buildVersionWallPreviewDataUrl } from "@/lib/import-reference-preview";
import { fetchPdfImportReferencePreview } from "@/lib/import-reference-preview-client";

export async function resolveImportReferencePreview(
  file: CopilotPinnedFile,
  analysis: AnalyzePlanClientResult,
  pdfPageNumber = 1
): Promise<string | undefined> {
  if (file.sourceType === "image") {
    return file.previewUrl;
  }

  if (file.sourceType === "pdf") {
    try {
      return await fetchPdfImportReferencePreview(file.base64, pdfPageNumber);
    } catch {
      return undefined;
    }
  }

  if (file.sourceType === "dxf") {
    return buildVersionWallPreviewDataUrl(analysis.version);
  }

  return undefined;
}
