import { NextResponse } from "next/server";
import { generatePresentationPptxBuffer } from "@/lib/presentation/render-pptx";
import type { PresentationDeck } from "@/lib/presentation/types";

export const runtime = "nodejs";

interface ExportPresentationPptxRequest {
  deck?: PresentationDeck;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ExportPresentationPptxRequest;

  if (!body.deck?.slides?.length) {
    return NextResponse.json({ error: "deck with slides is required." }, { status: 400 });
  }

  const fileName = `${body.deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.pptx`;

  try {
    const buffer = await generatePresentationPptxBuffer(body.deck);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate PPTX.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
