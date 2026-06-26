import { decodeBase64File } from "@/lib/plan-import/file-input";
import { renderPdfPageToImage } from "@/lib/plan-import/pdf-import";
import { apiError, apiOk } from "@/lib/server/api-response";
import type { PlanImportSource } from "@/lib/plan-import/types";

interface ImportReferencePreviewRequest {
  fileBase64?: string;
  sourceType?: PlanImportSource;
  pageNumber?: number;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ImportReferencePreviewRequest;

  if (!body.fileBase64?.trim()) {
    return apiError("fileBase64 is required.", 400, "INVALID_PAYLOAD");
  }

  if (body.sourceType !== "pdf") {
    return apiError("Only PDF reference previews are supported by this route.", 400, "INVALID_PAYLOAD");
  }

  try {
    const buffer = decodeBase64File(body.fileBase64);

    if (!buffer) {
      return apiError("fileBase64 must be valid base64.", 400, "INVALID_PAYLOAD");
    }

    const rendered = await renderPdfPageToImage(buffer, body.pageNumber ?? 1);

    return apiOk({
      previewUrl: `data:image/png;base64,${rendered.base64}`,
      mediaType: rendered.mediaType,
      byteLength: rendered.byteLength
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render PDF reference preview.";
    return apiError(message, 500, "PREVIEW_FAILED");
  }
}
