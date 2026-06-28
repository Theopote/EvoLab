import { apiError, apiOk } from "@/lib/server/api-response";
import { decodeBase64File } from "@/lib/plan-import/file-input";
import type { UploadImportRequest, UploadImportResponse, ImportMetadata } from "@/lib/import-types";
import { z } from "zod";

const UploadImportRequestSchema = z.object({
  fileBase64: z.string().min(1),
  fileName: z.string().min(1).max(255),
  sourceType: z.enum(["image", "pdf", "dxf", "sketch"]),
  selectedPage: z.number().int().min(1).optional()
});

// Image magic bytes for validation
const IMAGE_MAGIC_BYTES = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  jpg: [0xff, 0xd8, 0xff]
};

function validateImageMagicBytes(buffer: Buffer, expectedType: string): boolean {
  const magicBytes = IMAGE_MAGIC_BYTES[expectedType as keyof typeof IMAGE_MAGIC_BYTES];
  if (!magicBytes) return false;

  for (let i = 0; i < magicBytes.length; i++) {
    if (buffer[i] !== magicBytes[i]) return false;
  }
  return true;
}

function detectImageDimensions(buffer: Buffer, type: string): { width: number; height: number } | null {
  try {
    if (type === "png" && buffer.length > 24) {
      // PNG: width at bytes 16-19, height at bytes 20-23 (big endian)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    } else if ((type === "jpeg" || type === "jpg") && buffer.length > 160) {
      // JPEG: scan for SOF0 marker (0xFF 0xC0)
      for (let i = 0; i < buffer.length - 9; i++) {
        if (buffer[i] === 0xff && buffer[i + 1] === 0xc0) {
          const height = buffer.readUInt16BE(i + 5);
          const width = buffer.readUInt16BE(i + 7);
          return { width, height };
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = UploadImportRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return apiError("Invalid upload request.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const body = parsed.data;

  try {
    const buffer = decodeBase64File(body.fileBase64);

    if (!buffer) {
      return apiError("Invalid base64 data.", 400, "INVALID_PAYLOAD");
    }

    // Validate file type based on magic bytes
    const fileExt = body.fileName.split(".").pop()?.toLowerCase();

    if (body.sourceType === "image") {
      const isValidImage =
        (fileExt === "png" && validateImageMagicBytes(buffer, "png")) ||
        ((fileExt === "jpg" || fileExt === "jpeg") && validateImageMagicBytes(buffer, "jpeg"));

      if (!isValidImage) {
        return apiError("File is not a valid image (magic bytes mismatch).", 400, "INVALID_FILE_TYPE");
      }

      const dimensions = detectImageDimensions(buffer, fileExt || "");
      const metadata: ImportMetadata = {
        width: dimensions?.width,
        height: dimensions?.height,
        dpi: 150 // Default DPI, user can calibrate
      };

      const sessionId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response: UploadImportResponse = {
        sessionId,
        source: {
          id: sessionId,
          type: "image",
          fileName: body.fileName,
          fileSize: buffer.length,
          uploadedAt: new Date().toISOString(),
          base64: body.fileBase64,
          metadata
        },
        metadata
      };

      return apiOk(response);
    }

    if (body.sourceType === "pdf") {
      // PDF validation already handled in pdf-page-info route
      // For now, create session with basic metadata
      const sessionId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const metadata: ImportMetadata = {
        pageCount: 1, // Will be detected by pdf-page-info
        selectedPage: body.selectedPage || 1
      };

      const response: UploadImportResponse = {
        sessionId,
        source: {
          id: sessionId,
          type: "pdf",
          fileName: body.fileName,
          fileSize: buffer.length,
          uploadedAt: new Date().toISOString(),
          base64: body.fileBase64,
          metadata
        },
        metadata
      };

      return apiOk(response);
    }

    if (body.sourceType === "dxf") {
      // DXF is text-based, basic validation
      const dxfText = buffer.toString("utf-8", 0, Math.min(1000, buffer.length));

      if (!dxfText.includes("SECTION") || !dxfText.includes("ENTITIES")) {
        return apiError("File does not appear to be a valid DXF.", 400, "INVALID_FILE_TYPE");
      }

      const sessionId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response: UploadImportResponse = {
        sessionId,
        source: {
          id: sessionId,
          type: "dxf",
          fileName: body.fileName,
          fileSize: buffer.length,
          uploadedAt: new Date().toISOString(),
          base64: body.fileBase64
        },
        metadata: {}
      };

      return apiOk(response);
    }

    return apiError("Unsupported source type.", 400, "INVALID_PAYLOAD");

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process upload.";
    return apiError(message, 500, "UPLOAD_FAILED");
  }
}
