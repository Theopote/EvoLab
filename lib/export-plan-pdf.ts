import { createPlanSvg } from "@/lib/export-utils";
import type { PlanVersion } from "@/lib/project-types";

function buildPlanPrintHtml(version: PlanVersion, totalArea: number) {
  const svg = createPlanSvg(version);
  const title = `${version.label} — Floor Plan`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A3 landscape; margin: 12mm; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #0f172a;
      background: #fff;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 12px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 8px;
    }
    h1 { margin: 0; font-size: 18px; }
    .meta { font-size: 12px; color: #475569; }
    .sheet {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      background: #f8fafc;
    }
    svg { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
  <header>
    <h1>${title}</h1>
    <div class="meta">${version.rooms.length} rooms · ${totalArea.toFixed(0)} sqm GFA</div>
  </header>
  <div class="sheet">${svg}</div>
</body>
</html>`;
}

export function openPlanPdfPrint(version: PlanVersion) {
  const popup = window.open("", "_blank");

  if (!popup) {
    throw new Error("Allow pop-ups to print the drawing as PDF.");
  }

  const totalArea = version.rooms.reduce((sum, room) => sum + room.areaSqm, 0);
  const html = buildPlanPrintHtml(version, totalArea);
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}
