import { decodeBase64File } from "@/lib/plan-import/file-input";
import { getPdfPageCount } from "@/lib/plan-import/pdf-import";
import { apiError, apiOk } from "@/lib/server/api-response";

interface PdfPageInfoRequest {
  fileBase64?: string;
}

// PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
function validatePdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46    // F
  );
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

    // Validate PDF magic bytes to ensure it's actually a PDF file
    if (!validatePdfMagicBytes(buffer)) {
      return apiError("File is not a valid PDF (missing PDF magic bytes).", 400, "INVALID_FILE_TYPE");
    }

    const numPages = await getPdfPageCount(buffer);

    return apiOk({ numPages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read PDF page count.";
    return apiError(message, 500, "PDF_READ_FAILED");
  }
}
