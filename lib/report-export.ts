import type { ReportDocument, SlideLayout } from "@/lib/report-types";
import { resolveBlockFromLayout } from "@/lib/report-layout-engine";

export function renderReportDocumentHtml(document: ReportDocument) {
  const sections = document.sections
    .map((section) => {
      const blocks = section.blocks
        .map((block) => {
          if (block.type === "paragraph") {
            return `<p>${escapeHtml(block.content ?? "")}</p>`;
          }

          if (block.type === "bullet_list") {
            return `<ul>${(block.bullets ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
          }

          if (block.type === "table" && block.table) {
            return `<table><thead><tr>${block.table.headers
              .map((header) => `<th>${escapeHtml(header)}</th>`)
              .join("")}</tr></thead><tbody>${block.table.rows
              .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
              .join("")}</tbody></table>`;
          }

          if (block.type === "image_ref") {
            return `<figure><div class="image-placeholder">${escapeHtml(block.imageRef?.caption ?? "Plan image")}</div></figure>`;
          }

          return "";
        })
        .join("");

      return `<section id="${section.id}"><h2>${escapeHtml(section.title)}</h2>${blocks}</section>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(document.title)}</title>
<style>body{font-family:Georgia,serif;max-width:820px;margin:40px auto;line-height:1.6;color:#111}
h1,h2{margin-top:1.4em}table{width:100%;border-collapse:collapse;margin:12px 0}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}.image-placeholder{border:1px dashed #999;padding:40px;text-align:center;color:#666}</style>
</head><body><h1>${escapeHtml(document.title)}</h1>${sections}</body></html>`;
}

export function renderSlideLayoutHtml(document: ReportDocument, layout: SlideLayout) {
  const slides = layout.slides
    .map((slide, index) => {
      const elements = slide.elements
        .map((element) => {
          const resolved = resolveBlockFromLayout(document, element.blockRef);

          if (!resolved) {
            return `<div style="left:${element.x}%;top:${element.y}%;width:${element.w}%;height:${element.h}%"></div>`;
          }

          const { block } = resolved;
          const text =
            block.type === "paragraph"
              ? block.content ?? ""
              : block.type === "bullet_list"
                ? (block.bullets ?? []).join(" · ")
                : block.type === "table"
                  ? (block.table?.rows ?? []).map((row) => row.join(" | ")).join("<br/>")
                  : block.imageRef?.caption ?? "";

          return `<div class="element" style="left:${element.x}%;top:${element.y}%;width:${element.w}%;height:${element.h}%">${text}</div>`;
        })
        .join("");

      return `<section class="slide"><div class="slide-index">Slide ${index + 1}</div>${elements}</section>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(document.title)} Slides</title>
<style>body{margin:0;background:#111;color:#f5f5f5;font-family:Arial,sans-serif}.slide{position:relative;min-height:100vh;border-bottom:1px solid #333;padding:32px;box-sizing:border-box}
.slide-index{font-size:12px;opacity:.6;margin-bottom:12px}.element{position:absolute;overflow:hidden;font-size:14px;line-height:1.4}</style>
</head><body>${slides}</body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function downloadReportPdf(html: string, fileName: string) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    throw new Error("Allow pop-ups to export the report PDF.");
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.document.title = fileName;
}
