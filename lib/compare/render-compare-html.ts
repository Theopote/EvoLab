import type { CompareReport } from "@/lib/compare/compare-report-types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTable(headers: string[], rows: string[][]) {
  return `<table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("")}</tbody>
  </table>`;
}

export function renderCompareReportHtml(report: CompareReport) {
  const generated = new Date(report.generatedAt).toLocaleString();
  const recommendationBullets = report.recommendation.explanations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const diffSection = report.diff
    ? `<section class="section">
        <h2>Geometry diff · ${escapeHtml(report.diff.baseLabel)} → ${escapeHtml(report.diff.previewLabel)}</h2>
        <p class="meta">Modified ${report.diff.modified} · Added ${report.diff.added} · Removed ${report.diff.removed}</p>
        <div class="diagram">${report.diff.svg}</div>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.projectName)} · Scheme Comparison</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #eef3f7;
        --panel: #ffffff;
        --border: #d6e0ea;
        --accent: #0f766e;
        --heading: #0f172a;
        --text: #334155;
        --meta: #64748b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background: var(--bg);
        color: var(--heading);
      }
      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: 32px 24px 48px;
      }
      .hero, .section {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 20px;
      }
      .meta {
        color: var(--meta);
        font-size: 13px;
        margin: 0 0 12px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
      }
      h2 {
        margin: 0 0 12px;
        font-size: 18px;
        color: var(--accent);
      }
      ul {
        margin: 12px 0 0;
        padding-left: 20px;
        color: var(--text);
        line-height: 1.6;
      }
      .badge {
        display: inline-block;
        border: 1px solid rgba(15, 118, 110, 0.35);
        background: rgba(15, 118, 110, 0.08);
        color: var(--accent);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        margin-right: 8px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      th, td {
        border-bottom: 1px solid var(--border);
        padding: 10px 8px;
        text-align: left;
      }
      th {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--meta);
      }
      .diagram {
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #081018;
        padding: 12px;
      }
      .diagram svg {
        display: block;
        width: 100%;
        height: auto;
      }
      @media print {
        body { background: white; }
        main { max-width: none; padding: 0; }
        .hero, .section { break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <main>
      <header class="hero">
        <p class="meta">EvoLab Scheme Comparison Report · ${escapeHtml(generated)}</p>
        <h1>${escapeHtml(report.projectName)}</h1>
        <p class="meta">${escapeHtml(report.projectType)}${report.levelName ? ` · ${escapeHtml(report.levelName)}` : ""}</p>
        <p class="meta">Pinned schemes: ${escapeHtml(report.pinnedVersionLabels.join(" · "))}</p>
      </header>

      <section class="section">
        <h2>Recommendation</h2>
        <p><span class="badge">Recommended: ${escapeHtml(report.recommendation.versionLabel)}</span></p>
        <p class="meta">${escapeHtml(report.recommendation.summary)}</p>
        ${recommendationBullets ? `<ul>${recommendationBullets}</ul>` : `<p class="meta">Both options score similarly across weighted metrics.</p>`}
      </section>

      <section class="section">
        <h2>Metric comparison</h2>
        <p class="meta">* active scheme · ★ recommended scheme</p>
        ${renderTable(report.metricTable.headers, report.metricTable.rows)}
      </section>

      ${diffSection}
    </main>
  </body>
</html>`;
}

export function downloadCompareReportHtml(report: CompareReport) {
  const html = renderCompareReportHtml(report);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${report.projectName.replace(/\s+/g, "-").toLowerCase()}-compare-report.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}
