import { NextRequest, NextResponse } from "next/server";
import type { PresentationDocument } from "@/lib/presentation-studio/types";

export async function POST(req: NextRequest) {
  try {
    const document: PresentationDocument = await req.json();

    // 动态导入pptxgenjs
    const { default: PptxGenJS } = await import("pptxgenjs");
    const pptx = new PptxGenJS();

    pptx.layout = "LAYOUT_16x9";
    pptx.author = "EvoLab Presentation Studio";
    pptx.subject = document.subtitle || document.title;
    pptx.title = document.title;

    // 添加标题页
    const titleSlide = pptx.addSlide();
    titleSlide.background = { color: "1E293B" };
    titleSlide.addText(document.title, {
      x: 0.6,
      y: 2.5,
      w: 9,
      h: 1.2,
      fontSize: 42,
      bold: true,
      color: "FFFFFF",
      align: "center"
    });

    if (document.subtitle) {
      titleSlide.addText(document.subtitle, {
        x: 0.6,
        y: 3.8,
        w: 9,
        h: 0.6,
        fontSize: 18,
        color: "CBD5E1",
        align: "center"
      });
    }

    titleSlide.addText(`Generated ${new Date().toLocaleString()}`, {
      x: 0.6,
      y: 6.8,
      w: 9,
      h: 0.4,
      fontSize: 11,
      color: "94A3B8",
      align: "center"
    });

    // 添加内容幻灯片
    for (const slide of document.slides) {
      const page = pptx.addSlide();
      page.background = { color: "FFFFFF" };

      // 标题
      if (slide.title) {
        page.addText(slide.title, {
          x: 0.5,
          y: 0.35,
          w: 9,
          h: 0.7,
          fontSize: 28,
          bold: true,
          color: "1E293B"
        });
      }

      // 副标题
      if (slide.subtitle) {
        page.addText(slide.subtitle, {
          x: 0.5,
          y: 1.05,
          w: 9,
          h: 0.4,
          fontSize: 14,
          color: "64748B"
        });
      }

      const contentY = slide.subtitle ? 1.6 : 1.2;

      // 内容 - 要点列表
      if (slide.bullets && slide.bullets.length > 0) {
        const bulletText = slide.bullets.map((bullet) => ({
          text: bullet,
          options: { bullet: true, breakLine: true }
        }));

        page.addText(bulletText, {
          x: 0.6,
          y: contentY,
          w: 8.8,
          h: 4.5,
          fontSize: 14,
          color: "334155",
          valign: "top"
        });
      }
      // 内容 - 段落文字
      else if (slide.content) {
        page.addText(slide.content, {
          x: 0.6,
          y: contentY,
          w: 8.8,
          h: 4.5,
          fontSize: 14,
          color: "334155",
          valign: "top"
        });
      }

      // 图片说明（占位）
      if (slide.imageCaption) {
        page.addText(`📷 ${slide.imageCaption}`, {
          x: 0.6,
          y: 6.0,
          w: 8.8,
          h: 0.5,
          fontSize: 11,
          color: "64748B",
          italic: true
        });
      }

      // 页脚（演讲备注提示）
      if (slide.notes) {
        page.addNotes(slide.notes);
      }
    }

    // 生成buffer
    const buffer = await pptx.write({ outputType: "nodebuffer" });

    return new NextResponse(buffer as Buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.title)}.pptx"`
      }
    });
  } catch (error) {
    console.error("PPTX export failed:", error);
    return NextResponse.json(
      { error: "Failed to generate PPTX", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
