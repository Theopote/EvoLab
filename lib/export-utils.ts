import type { ComplianceItem, QuantityResult } from "@/lib/quantity-engine";
import { createIfcExportPayload } from "@/lib/ifc-export-contract";
import type { PlanVersion, ProjectData, Room } from "@/lib/project-types";

const zoneColors: Record<Room["zone"], string> = {
  public: "rgba(79,181,200,0.28)",
  semi_public: "rgba(132,204,22,0.22)",
  private: "rgba(167,139,250,0.22)",
  service: "rgba(230,162,60,0.24)",
  circulation: "rgba(148,163,184,0.2)"
};

const zoneStrokes: Record<Room["zone"], string> = {
  public: "#4fb5c8",
  semi_public: "#84cc16",
  private: "#a78bfa",
  service: "#e6a23c",
  circulation: "#94a3b8"
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function centroid(room: Room) {
  const total = room.polygon.reduce(
    (acc, [x, y]) => ({ x: acc.x + x, y: acc.y + y }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / room.polygon.length,
    y: total.y / room.polygon.length
  };
}

function polygonPoints(points: [number, number][]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function createPlanSvg(version: PlanVersion) {
  const padding = 8;
  const width = version.overallBounds.width + padding * 2;
  const height = version.overallBounds.height + padding * 2;
  const viewBox = `${-padding} ${-padding} ${width} ${height}`;
  const rooms = version.rooms
    .map((room) => {
      const center = centroid(room);
      return `
  <g id="${escapeXml(room.id)}">
    <polygon points="${polygonPoints(room.polygon)}" fill="${zoneColors[room.zone]}" stroke="${zoneStrokes[room.zone]}" stroke-width="0.25" />
    <text x="${center.x}" y="${center.y - 0.8}" fill="#e5edf5" font-size="1.7" text-anchor="middle">${escapeXml(room.name)}</text>
    <text x="${center.x}" y="${center.y + 1.3}" fill="#9fb3c8" font-size="1.25" text-anchor="middle">${room.areaSqm} sqm</text>
  </g>`;
    })
    .join("\n");
  const level = version.levels[0];
  const walls = level?.walls
    .map(
      (wall) =>
        `<line x1="${wall.start[0]}" y1="${wall.start[1]}" x2="${wall.end[0]}" y2="${wall.end[1]}" stroke="${
          wall.type === "external" ? "#e5f6ff" : wall.type === "core" ? "#f0b35b" : "#7d8fa3"
        }" stroke-width="${wall.thickness}" stroke-linecap="round" />`
    )
    .join("\n");
  const openings = level?.openings
    .map(
      (opening) =>
        `<circle cx="${opening.center[0]}" cy="${opening.center[1]}" r="${
          opening.type === "door" ? 0.45 : 0.35
        }" fill="${opening.type === "door" ? "#4fb5c8" : "#84cc16"}" stroke="#081018" stroke-width="0.16" />`
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width * 10}" height="${height * 10}">
  <rect x="${-padding}" y="${-padding}" width="${width}" height="${height}" fill="#081018" />
  <polygon points="${polygonPoints(version.outline)}" fill="rgba(255,255,255,0.018)" stroke="#d8edf5" stroke-width="0.35" />
${rooms}
${walls ?? ""}
${openings ?? ""}
</svg>
`;
}

export function createQuantityCsv(quantities: QuantityResult) {
  const header = ["Item", "Value", "Unit", "Basis"];
  const rows = quantities.rows.map((row) => [row.label, row.value, row.unit, row.basis]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function createComplianceCsv(items: ComplianceItem[]) {
  const header = ["Title", "Status", "Message", "Basis"];
  const rows = items.map((item) => [item.title, item.status, item.message, item.basis]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function exportProjectJson(project: ProjectData) {
  downloadTextFile(`${project.projectId}.json`, JSON.stringify(project, null, 2), "application/json");
}

export function exportVersionJson(version: PlanVersion) {
  downloadTextFile(`${version.id}.json`, JSON.stringify(version, null, 2), "application/json");
}

export function exportIfcHandoffJson(version: PlanVersion) {
  downloadTextFile(`${version.id}-ifc-handoff.json`, JSON.stringify(createIfcExportPayload(version), null, 2), "application/json");
}
