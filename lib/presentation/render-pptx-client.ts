import { readApiBlob } from "@/lib/api-client";
import type { PresentationDeck } from "@/lib/presentation/types";

export function svgToPngDataUrl(svg: string, width = 1280, height = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas context unavailable."));
        return;
      }

      context.fillStyle = "#081018";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => reject(new Error("Failed to rasterize SVG for PPTX export."));
    image.src = url;
  });
}

export async function prepareDeckForPptx(deck: PresentationDeck): Promise<PresentationDeck> {
  const slides = await Promise.all(
    deck.slides.map(async (slide) => {
      if (!slide.svg || slide.images?.length) {
        return slide;
      }

      try {
        const pngDataUrl = await svgToPngDataUrl(slide.svg);
        return {
          ...slide,
          images: [{ id: `${slide.id}-svg`, label: slide.title, dataUrl: pngDataUrl }]
        };
      } catch {
        return slide;
      }
    })
  );

  return { ...deck, slides };
}

export async function downloadPresentationPptxViaApi(deck: PresentationDeck) {
  const response = await fetch("/api/export-presentation-pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deck })
  });

  const blob = await readApiBlob(response);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.pptx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadPresentationPdfViaApi(deck: PresentationDeck) {
  const response = await fetch("/api/export-presentation-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deck })
  });

  const blob = await readApiBlob(response);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
