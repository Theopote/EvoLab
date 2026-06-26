import { NextResponse } from "next/server";
import { renderPresentationHtml } from "@/lib/presentation/render-html";
import { apiError } from "@/lib/server/api-response";
import { PresentationDeckSchema } from "@/lib/schemas/presentation-schema";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = PresentationDeckSchema.safeParse(body.deck ?? body);

  if (!parsed.success) {
    return apiError("Invalid presentation deck.", 400, "INVALID_PAYLOAD", parsed.error.message);
  }

  const deck = parsed.data;
  const html = renderPresentationHtml(deck);
  const fileName = `${deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.pdf`;

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      preferCSSPageSize: true
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
    return apiError(
      error instanceof Error
        ? error.message
        : "Server PDF export unavailable. Run `npx playwright install chromium` after installing playwright.",
      503,
      "PDF_EXPORT_UNAVAILABLE"
    );
  }
}
