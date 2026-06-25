import { NextResponse } from "next/server";
import { createMockAnalyzedVersion } from "@/lib/mock-api";
import { importPlan } from "@/lib/plan-import";
import type { PlanImportSource } from "@/lib/plan-import/types";

interface AnalyzePlanRequest {
  fileBase64?: string;
  imageBase64?: string;
  fileName?: string;
  sourceType?: PlanImportSource;
  pdfPageNumber?: number;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AnalyzePlanRequest;
  const fallback = createMockAnalyzedVersion();

  try {
    const result = await importPlan({
      fileBase64: body.fileBase64 ?? body.imageBase64,
      imageBase64: body.imageBase64,
      fileName: body.fileName,
      sourceType: body.sourceType,
      pdfPageNumber: body.pdfPageNumber
    });

    return NextResponse.json({
      version: result.version,
      confidence: result.confidence,
      warnings: result.warnings,
      sourceType: result.sourceType,
      importPath: result.importPath
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to analyze plan.";

    if (/required|valid base64|too large|Unsupported/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({
      ...fallback,
      fallback: true,
      warnings: [...fallback.warnings, message]
    });
  }
}
