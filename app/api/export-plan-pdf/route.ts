import { NextResponse } from "next/server";
import { buildPlanPrintHtml } from "@/lib/export-plan-pdf";
import type { PlanVersion } from "@/lib/project-types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ExportPlanPdfRequest {
  version?: PlanVersion;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ExportPlanPdfRequest;

  if (!body.version?.rooms?.length) {
    return NextResponse.json({ error: "version with rooms is required." }, { status: 400 });
  }

  const totalArea = body.version.rooms.reduce((sum, room) => sum + room.areaSqm, 0);
  const html = buildPlanPrintHtml(body.version, totalArea);
  const fileName = `${body.version.id}-plan.pdf`;

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A3",
      landscape: true,
      printBackground: true,
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" }
    });
    await browser.close();

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Server PDF export unavailable. Run `npx playwright install chromium` after installing playwright."
      },
      { status: 503 }
    );
  }
}
