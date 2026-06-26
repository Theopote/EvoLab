import { resolvePresentationTemplate } from "@/lib/presentation/templates";
import type { PresentationDeck } from "@/lib/presentation/types";
import { readApiBlob } from "@/lib/api-client";

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
  const diagramClass = slide.kind === "evolution" ? "diagram diagram-evolution" : "diagram";
  const diagram = slide.svg
    ? `<div class="${diagramClass}">${slide.svg.replace("<svg", '<svg width="100%" height="100%" preserveAspectRatio="xMidYMid meet"')}</div>`
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
  const template = resolvePresentationTemplate(deck.templateId);
  const slides = deck.slides.map((slide, index) => renderSlide(slide, index)).join("\n");
  const storyArc = deck.storyArc?.length
    ? `<p class="story-arc">${escapeHtml(deck.storyArc.join(" → "))}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(deck.projectName)} · Presentation</title>
    <style>
      :root {
        color-scheme: ${deck.templateId === "studio" ? "dark" : "light"};
        --body-bg: ${template.html.bodyBackground};
        --slide-bg: ${template.html.slideBackground};
        --slide-border: ${template.html.slideBorder};
        --accent: ${template.html.accent};
        --heading: ${template.html.heading};
        --subheading: ${template.html.subheading};
        --text: ${template.html.text};
        --meta: ${template.html.meta};
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background: var(--body-bg);
        color: var(--heading);
      }
      .deck {
        max-width: 1120px;
        margin: 0 auto;
        padding: 24px;
      }
      .slide {
        background: var(--slide-bg);
        border: 1px solid var(--slide-border);
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
        color: var(--meta);
        margin-bottom: 12px;
      }
      .story-arc {
        margin: 0 0 16px;
        padding: 10px 12px;
        border-left: 3px solid var(--accent);
        color: var(--subheading);
        font-size: 14px;
        line-height: 1.5;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 34px;
        line-height: 1.1;
        color: var(--heading);
      }
      h2 {
        margin: 0 0 18px;
        font-size: 18px;
        font-weight: 500;
        color: var(--subheading);
      }
      ul {
        margin: 0 0 20px;
        padding-left: 20px;
        line-height: 1.6;
        color: var(--text);
      }
      .diagram {
        height: 360px;
        border: 1px solid var(--slide-border);
        border-radius: 12px;
        overflow: hidden;
        background: #081018;
        margin-top: 12px;
      }
      .diagram-evolution {
        height: 420px;
      }
      .diagram-evolution svg g:nth-child(2) { animation: reveal-panel 4.5s ease-in-out infinite; }
      .diagram-evolution svg g:nth-child(3) { animation: reveal-panel 4.5s ease-in-out infinite 1.5s; }
      .diagram-evolution svg g:nth-child(4) { animation: reveal-panel 4.5s ease-in-out infinite 3s; }
      @keyframes reveal-panel {
        0%, 18% { opacity: 0.25; }
        28%, 72% { opacity: 1; }
        82%, 100% { opacity: 0.25; }
      }
      .image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin-top: 12px;
      }
      .image-grid figure {
        margin: 0;
        border: 1px solid var(--slide-border);
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
        color: var(--meta);
        background: ${deck.templateId === "studio" ? "#0f172a" : "#f8fafc"};
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 16px;
        font-size: 14px;
        color: var(--text);
      }
      th, td {
        border: 1px solid var(--slide-border);
        padding: 8px 10px;
        text-align: left;
      }
      th {
        background: ${deck.templateId === "studio" ? "#0f172a" : "#f8fafc"};
        color: var(--heading);
      }
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
        .diagram-evolution svg g { opacity: 1 !important; animation: none !important; }
      }
    </style>
  </head>
  <body>
    <main class="deck">
      <header class="slide">
        <div class="slide-meta">EvoLab Presentation Export · ${escapeHtml(template.label)}</div>
        <h1>${escapeHtml(deck.projectName)}</h1>
        <h2>${escapeHtml(deck.projectType)} · ${escapeHtml(deck.versionLabel)}</h2>
        ${storyArc}
        <ul>
          <li>Generated ${escapeHtml(new Date(deck.generatedAt).toLocaleString())}</li>
          <li>${deck.slides.length} slides with diagrams, cost schedule, and quantity tables</li>
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

export async function downloadPresentationViaApi(deck: PresentationDeck) {
  const response = await fetch("/api/export-presentation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deck })
  });

  const blob = await readApiBlob(response);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${deck.projectName.replace(/\s+/g, "-").toLowerCase()}-presentation.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
