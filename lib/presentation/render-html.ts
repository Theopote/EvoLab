import type { PresentationDeck } from "@/lib/presentation/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderSlide(slide: PresentationDeck["slides"][number], index: number) {
  const bullets = slide.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("");
  const table = slide.table
    ? `<table>
        <thead><tr>${slide.table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${slide.table.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>`
    : "";
  const diagram = slide.svg
    ? `<div class="diagram">${slide.svg.replace("<svg", '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"')}</div>`
    : "";
  const images = slide.images?.length
    ? `<div class="image-grid">${slide.images
        .map(
          (image) =>
            `<figure><img src="${image.dataUrl}" alt="${escapeHtml(image.label)}" /><figcaption>${escapeHtml(image.label)}</figcaption></figure>`
        )
        .join("")}</div>`
    : "";

  return `
    <section class="slide" id="slide-${index + 1}">
      <div class="slide-meta">Slide ${index + 1} · ${escapeHtml(slide.kind)}</div>
      <h1>${escapeHtml(slide.title)}</h1>
      ${slide.subtitle ? `<h2>${escapeHtml(slide.subtitle)}</h2>` : ""}
      <ul>${bullets}</ul>
      ${diagram}
      ${images}
      ${table}
    </section>`;
}

export function renderPresentationHtml(deck: PresentationDeck) {
  const slides = deck.slides.map((slide, index) => renderSlide(slide, index)).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(deck.projectName)} · Presentation</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background: #f4f7fb;
        color: #0f172a;
      }
      .deck {
        max-width: 1120px;
        margin: 0 auto;
        padding: 24px;
      }
      .slide {
        background: #ffffff;
        border: 1px solid #dbe4ee;
        border-radius: 18px;
        padding: 32px 36px;
        margin: 0 0 24px;
        min-height: 640px;
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08);
        break-after: page;
        page-break-after: always;
      }
      .slide-meta {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64748b;
        margin-bottom: 12px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 34px;
        line-height: 1.1;
      }
      h2 {
        margin: 0 0 18px;
        font-size: 18px;
        font-weight: 500;
        color: #475569;
      }
      ul {
        margin: 0 0 20px;
        padding-left: 20px;
        line-height: 1.6;
        color: #334155;
      }
      .diagram {
        height: 360px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
        background: #081018;
        margin-top: 12px;
      }
      .image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .image-grid figure {
        margin: 0;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        overflow: hidden;
        background: #081018;
      }
      .image-grid img {
        display: block;
        width: 100%;
        height: 220px;
        object-fit: cover;
      }
      .image-grid figcaption {
        padding: 8px 10px;
        font-size: 12px;
        color: #64748b;
        background: #f8fafc;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        font-size: 14px;
      }
      th, td {
        border: 1px solid #e2e8f0;
        padding: 8px 10px;
        text-align: left;
      }
      th { background: #f8fafc; }
      @media print {
        body { background: white; }
        .deck { padding: 0; max-width: none; }
        .slide {
          margin: 0;
          border: none;
          border-radius: 0;
          box-shadow: none;
          min-height: auto;
        }
      }
    </style>
  </head>
  <body>
    <main class="deck">
      <header class="slide">
        <div class="slide-meta">EvoLab Presentation Export</div>
        <h1>${escapeHtml(deck.projectName)}</h1>
        <h2>${escapeHtml(deck.projectType)} · ${escapeHtml(deck.versionLabel)}</h2>
        <ul>
          <li>Generated ${escapeHtml(new Date(deck.generatedAt).toLocaleString())}</li>
          <li>${deck.slides.length} slides with auto-diagrams and quantity tables</li>
        </ul>
      </header>
      ${slides}
    </main>
  </body>
</html>`;
}

export function downloadPresentationHtml(deck: PresentationDeck) {
  const html = renderPresentationHtml(deck);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
