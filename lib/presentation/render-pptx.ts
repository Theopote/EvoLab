import { resolvePresentationTemplate } from "@/lib/presentation/templates";
import type { PresentationDeck, PresentationSlide } from "@/lib/presentation/types";

function addTitleSlide(pptx: import("pptxgenjs").default, deck: PresentationDeck) {
  const template = resolvePresentationTemplate(deck.templateId);
  const slide = pptx.addSlide();
  slide.background = { color: template.pptx.titleBackground };
  slide.addText(deck.projectName, {
    x: 0.6,
    y: 1.2,
    w: 9,
    h: 1,
    fontSize: 34,
    bold: true,
    color: template.pptx.titleText
  });
  slide.addText(`${deck.projectType} · ${deck.versionLabel}`, {
    x: 0.6,
    y: 2.2,
    w: 9,
    h: 0.6,
    fontSize: 16,
    color: template.pptx.titleMuted
  });
  if (deck.storyArc?.length) {
    slide.addText(deck.storyArc.join(" → "), {
      x: 0.6,
      y: 3.1,
      w: 8.8,
      h: 0.8,
      fontSize: 11,
      color: template.pptx.titleMuted
    });
  }
  slide.addText(`Generated ${new Date(deck.generatedAt).toLocaleString()}`, {
    x: 0.6,
    y: 6.8,
    w: 9,
    h: 0.4,
    fontSize: 11,
    color: template.pptx.muted
  });
}

function addImageGrid(
  page: import("pptxgenjs").default.Slide,
  images: NonNullable<PresentationSlide["images"]>,
  originY: number,
  labelColor: string
) {
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
      color: labelColor,
      align: "center"
    });
  });
}

function addContentSlide(pptx: import("pptxgenjs").default, slide: PresentationSlide, deck: PresentationDeck) {
  const template = resolvePresentationTemplate(deck.templateId);
  const page = pptx.addSlide();
  const imageHeavy = Boolean(slide.images?.length && slide.images.length >= 2);
  const tablePrimary = Boolean(
    slide.table &&
      (slide.kind === "cost" ||
        slide.kind === "quantities" ||
        slide.kind === "evolution" ||
        slide.kind === "compare")
  );

  page.background = { color: template.pptx.contentBackground };
  page.addText(slide.title, {
    x: 0.5,
    y: 0.35,
    w: 9,
    h: 0.7,
    fontSize: 24,
    bold: true,
    color: template.pptx.heading
  });

  if (slide.subtitle) {
    page.addText(slide.subtitle, {
      x: 0.5,
      y: 1.05,
      w: 9,
      h: 0.4,
      fontSize: 12,
      color: template.pptx.subheading
    });
  }

  const bulletText = slide.bullets.map((bullet) => ({
    text: bullet,
    options: { bullet: true, breakLine: true }
  }));

  if (tablePrimary && slide.table) {
    page.addText(bulletText, {
      x: 0.55,
      y: 1.45,
      w: 9,
      h: 1.1,
      fontSize: 11,
      color: template.pptx.body,
      valign: "top"
    });
    const rows = [slide.table.headers, ...slide.table.rows].map((row) => row.map((cell) => ({ text: cell })));
    page.addTable(rows, {
      x: 0.5,
      y: slide.svg ? 2.55 : 2.35,
      w: slide.svg ? 4.3 : 9,
      fontSize: 9,
      border: { type: "solid", color: "CBD5E1", pt: 0.5 },
      fill: { color: deck.templateId === "studio" ? "111827" : "F8FAFC" }
    });
    if (slide.svg) {
      page.addImage({
        data: `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(slide.svg)))}`,
        x: 5.0,
        y: 2.35,
        w: 4.7,
        h: 2.8
      });
    }
    return;
  }

  if (slide.images?.length) {
    if (imageHeavy) {
      page.addText(bulletText, {
        x: 0.55,
        y: 1.45,
        w: 9,
        h: 0.8,
        fontSize: 11,
        color: template.pptx.body,
        valign: "top"
      });
      addImageGrid(page, slide.images, 2.35, template.pptx.muted);
      return;
    }

    page.addText(bulletText, {
      x: 0.55,
      y: 1.55,
      w: 3.8,
      h: 3.6,
      fontSize: 12,
      color: template.pptx.body,
      valign: "top"
    });
    addImageGrid(page, slide.images, 1.55, template.pptx.muted);
    return;
  }

  page.addText(bulletText, {
    x: 0.55,
    y: 1.55,
    w: 4.2,
    h: 4.8,
    fontSize: 12,
    color: template.pptx.body,
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

export async function generatePresentationPptxBuffer(deck: PresentationDeck): Promise<Buffer> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = "EvoLab";
  pptx.subject = deck.projectType;
  pptx.title = deck.projectName;

  addTitleSlide(pptx, deck);
  deck.slides.forEach((slide) => addContentSlide(pptx, slide, deck));

  const data = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(data as Buffer);
}
