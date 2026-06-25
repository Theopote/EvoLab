import { NextResponse } from "next/server";
import { decodeBase64File } from "@/lib/plan-import/file-input";
import { getPdfPageCount } from "@/lib/plan-import/pdf-import";

interface PdfPageInfoRequest {
  fileBase64?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PdfPageInfoRequest;

  if (!body.fileBase64?.trim()) {
    return NextResponse.json({ error: "fileBase64 is required." }, { status: 400 });
  }

  try {
    const buffer = decodeBase64File(body.fileBase64);

    if (!buffer) {
      return NextResponse.json({ error: "fileBase64 must be valid base64." }, { status: 400 });
    }

    const numPages = await getPdfPageCount(buffer);

    return NextResponse.json({ numPages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read PDF page count.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
