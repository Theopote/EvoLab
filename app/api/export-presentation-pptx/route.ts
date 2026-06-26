import { NextResponse } from "next/server";
import { generatePresentationPptxBuffer } from "@/lib/presentation/render-pptx";
import { PresentationDeckSchema } from "@/lib/schemas/presentation-schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = PresentationDeckSchema.safeParse(body.deck ?? body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid presentation deck.", details: parsed.error.message },
      { status: 400 }
    );
  }

  const deck = parsed.data;
  const fileName = `${deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.pptx`;

  try {
    const buffer = await generatePresentationPptxBuffer(deck);

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
