import type { PresentationDeck, PresentationSlide } from "@/lib/presentation/types";

function addTitleSlide(pptx: import("pptxgenjs").default, deck: PresentationDeck) {
  const slide = pptx.addSlide();
  slide.background = { color: "0F172A" };
  slide.addText(deck.projectName, {
    x: 0.6,
    y: 1.2,
    w: 9,
    h: 1,
    fontSize: 34,
    bold: true,
    color: "F8FAFC"
  });
  slide.addText(`${deck.projectType} · ${deck.versionLabel}`, {
    x: 0.6,
    y: 2.2,
    w: 9,
    h: 0.6,
    fontSize: 16,
    color: "94A3B8"
  });
  slide.addText(`Generated ${new Date(deck.generatedAt).toLocaleString()}`, {
    x: 0.6,
    y: 6.8,
    w: 9,
    h: 0.4,
    fontSize: 11,
    color: "64748B"
  });
}

function addImageGrid(page: import("pptxgenjs").default.Slide, images: NonNullable<PresentationSlide["images"]>, originY: number) {
  const columns = Math.min(3, images.length);
  const gap = 0.15;
  const gridWidth = 9;
  const imageWidth = (gridWidth - gap * (columns - 1)) / columns;
  const imageHeight = images.length > 3 ? 1.65 : 2.35;

  images.forEach((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 0.5 + column * (imageWidth + gap);
    const y = originY + row * (imageHeight + 0.35);

    page.addImage({
      data: image.dataUrl,
      x,
      y,
      w: imageWidth,
      h: imageHeight
    });
    page.addText(image.label, {
      x,
      y: y + imageHeight + 0.05,
      w: imageWidth,
      h: 0.2,
      fontSize: 9,
      color: "64748B",
      align: "center"
    });
  });
}

function addContentSlide(pptx: import("pptxgenjs").default, slide: PresentationSlide) {
  const page = pptx.addSlide();
  const imageHeavy = Boolean(slide.images?.length && slide.images.length >= 2);

  page.background = { color: "FFFFFF" };
  page.addText(slide.title, {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.7,
    fontSize: 24,
    bold: true,
    color: "0F172A"
  });

  if (slide.subtitle) {
    page.addText(slide.subtitle, {
      x: 0.5,
      y: 1.05,
      w: 9,
      h: 0.4,
      fontSize: 12,
      color: "475569"
    });
  }

  const bulletText = slide.bullets.map((bullet) => ({
    text: bullet,
    options: { bullet: true, breakLine: true }
  }));

  if (slide.images?.length) {
    if (imageHeavy) {
      page.addText(bulletText, {
        x: 0.55,
        y: 1.45,
        w: 9,
        h: 0.8,
        fontSize: 11,
        color: "334155",
        valign: "top"
      });
      addImageGrid(page, slide.images, 2.35);
      return;
    }

    page.addText(bulletText, {
      x: 0.55,
      y: 1.55,
      w: 3.8,
      h: 3.6,
      fontSize: 12,
      color: "334155",
      valign: "top"
    });
    addImageGrid(page, slide.images, 1.55);
    return;
  }

  page.addText(bulletText, {
    x: 0.55,
    y: 1.55,
    w: 4.2,
    h: 4.8,
    fontSize: 12,
    color: "334155",
    valign: "top"
  });

  if (slide.svg) {
    page.addImage({
      data: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(slide.svg)))}`,
      x: 4.9,
      y: 1.55,
      w: 4.8,
      h: 4.6
    });
    return;
  }

  if (slide.table) {
    const rows = [slide.table.headers, ...slide.table.rows].map((row) => row.map((cell) => ({ text: cell })));
    page.addTable(rows, {
      x: 4.9,
      y: 1.55,
      w: 4.8,
      fontSize: 10,
      border: { type: "solid", color: "CBD5E1", pt: 0.5 },
      fill: { color: "F8FAFC" }
    });
  }
}

export async function downloadPresentationPptx(deck: PresentationDeck) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "EvoLab";
  pptx.subject = deck.projectType;
  pptx.title = deck.projectName;

  addTitleSlide(pptx, deck);
  deck.slides.forEach((slide) => addContentSlide(pptx, slide));

  const fileName = `${deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.pptx`;
  await pptx.writeFile({ fileName });
}

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
