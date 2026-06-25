import { NextResponse } from "next/server";
import { decodeBase64File } from "@/lib/plan-import/file-input";
import { renderPdfPageToImage } from "@/lib/plan-import/pdf-import";
import type { PlanImportSource } from "@/lib/plan-import/types";

interface ImportReferencePreviewRequest {
  fileBase64?: string;
  sourceType?: PlanImportSource;
  pageNumber?: number;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ImportReferencePreviewRequest;

  if (!body.fileBase64?.trim()) {
    return NextResponse.json({ error: "fileBase64 is required." }, { status: 400 });
  }

  if (body.sourceType !== "pdf") {
    return NextResponse.json({ error: "Only PDF reference previews are supported by this route." }, { status: 400 });
  }

  try {
    const buffer = decodeBase64File(body.fileBase64);

    if (!buffer) {
      return NextResponse.json({ error: "fileBase64 must be valid base64." }, { status: 400 });
    }

    const rendered = await renderPdfPageToImage(buffer, body.pageNumber ?? 1);

    return NextResponse.json({
      previewUrl: `data:image/png;base64,${rendered.base64}`,
      mediaType: rendered.mediaType,
      byteLength: rendered.byteLength
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render PDF reference preview.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
