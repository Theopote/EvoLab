import { NextResponse } from "next/server";
import { renderPresentationHtml } from "@/lib/presentation/render-html";
import type { PresentationDeck } from "@/lib/presentation/types";

interface ExportPresentationRequest {
  deck?: PresentationDeck;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ExportPresentationRequest;

  if (!body.deck?.slides?.length) {
    return NextResponse.json({ error: "deck with slides is required." }, { status: 400 });
  }

  const html = renderPresentationHtml(body.deck);
  const fileName = `${body.deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.html`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store"
    }
  });
}
