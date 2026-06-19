import type { ReportDocument, ReportSection, Slide, SlideLayout } from "@/lib/report-types";

function titleSlide(section: ReportSection): Slide {
  const paragraph = section.blocks.find((block) => block.type === "paragraph");

  return {
    id: `slide-${section.id}-title`,
    sourceSectionId: section.id,
    template: "title",
    elements: paragraph
      ? [{ blockRef: paragraph.id, x: 8, y: 28, w: 84, h: 18 }]
      : [{ blockRef: section.blocks[0]?.id ?? section.id, x: 8, y: 28, w: 84, h: 18 }]
  };
}

function tableSlide(section: ReportSection, blockId: string): Slide {
  return {
    id: `slide-${blockId}`,
    sourceSectionId: section.id,
    template: "table_full",
    elements: [{ blockRef: blockId, x: 6, y: 18, w: 88, h: 70 }]
  };
}

function twoColumnSlide(section: ReportSection, leftBlockId: string, rightBlockId: string): Slide {
  return {
    id: `slide-${leftBlockId}-${rightBlockId}`,
    sourceSectionId: section.id,
    template: "two_column",
    elements: [
      { blockRef: leftBlockId, x: 6, y: 18, w: 42, h: 70 },
      { blockRef: rightBlockId, x: 52, y: 18, w: 42, h: 70 }
    ]
  };
}

export function buildSlideLayout(document: ReportDocument): SlideLayout {
  const slides: Slide[] = [
    {
      id: "slide-cover",
      template: "title",
      elements: [{ blockRef: document.sections[0]?.blocks[0]?.id ?? "cover", x: 8, y: 24, w: 84, h: 24 }]
    }
  ];

  document.sections.forEach((section) => {
    slides.push(titleSlide(section));

    const paragraph = section.blocks.find((block) => block.type === "paragraph");
    const image = section.blocks.find((block) => block.type === "image_ref");
    const table = section.blocks.find((block) => block.type === "table");
    const bullets = section.blocks.find((block) => block.type === "bullet_list");

    if (paragraph && image) {
      slides.push(twoColumnSlide(section, paragraph.id, image.id));
    } else if (paragraph) {
      slides.push({
        id: `slide-${paragraph.id}`,
        sourceSectionId: section.id,
        template: "content_image",
        elements: [{ blockRef: paragraph.id, x: 8, y: 18, w: 84, h: 70 }]
      });
    }

    if (table) {
      slides.push(tableSlide(section, table.id));
    }

    if (bullets && !paragraph) {
      slides.push({
        id: `slide-${bullets.id}`,
        sourceSectionId: section.id,
        template: "content_image",
        elements: [{ blockRef: bullets.id, x: 8, y: 18, w: 84, h: 70 }]
      });
    }
  });

  return {
    id: `${document.id}-layout`,
    slides
  };
}

export function resolveBlockFromLayout(document: ReportDocument, blockRef: string) {
  for (const section of document.sections) {
    const block = section.blocks.find((item) => item.id === blockRef);

    if (block) {
      return { section, block };
    }
  }

  return undefined;
}
