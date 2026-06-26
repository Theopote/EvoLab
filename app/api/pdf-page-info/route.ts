import { decodeBase64File } from "@/lib/plan-import/file-input";
import { getPdfPageCount } from "@/lib/plan-import/pdf-import";
import { apiError, apiOk } from "@/lib/server/api-response";

interface PdfPageInfoRequest {
  fileBase64?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PdfPageInfoRequest;

  if (!body.fileBase64?.trim()) {
    return apiError("fileBase64 is required.", 400, "INVALID_PAYLOAD");
  }

  try {
    const buffer = decodeBase64File(body.fileBase64);

    if (!buffer) {
      return apiError("fileBase64 must be valid base64.", 400, "INVALID_PAYLOAD");
    }

    const numPages = await getPdfPageCount(buffer);

    return apiOk({ numPages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read PDF page count.";
    return apiError(message, 500, "PDF_READ_FAILED");
  }
}
