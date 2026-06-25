import { getViewBox, polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import type { RoomChangeSummary } from "@/lib/plan-change-diff";
import type { PlanVersion } from "@/lib/project-types";

function centroid(polygon: [number, number][]) {
  const total = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as [number, number], [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length] as [number, number];
}

export function renderCompareDiffSvg(
  baseVersion: PlanVersion,
  previewVersion: PlanVersion,
  changes: RoomChangeSummary
): string {
  const viewBox = getViewBox(previewVersion, 4);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="320" role="img" aria-label="Scheme geometry diff">`,
    `<polygon fill="rgba(255,255,255,0.02)" points="${polygonPoints(baseVersion.outline)}" stroke="rgba(216,237,245,0.35)" stroke-width="0.2" />`
  ];

  for (const room of baseVersion.rooms) {
    if (!changes.removed.includes(room.id)) {
      continue;
    }

    parts.push(
      `<polygon fill="rgba(244,63,94,0.18)" points="${polygonPoints(room.polygon)}" stroke="#f43f5e" stroke-dasharray="0.6 0.4" stroke-width="0.22" />`
    );
  }

  for (const room of previewVersion.rooms) {
    const isAdded = changes.added.includes(room.id);
    const isModified = changes.modified.includes(room.id);

    if (!isAdded && !isModified) {
      parts.push(
        `<polygon fill="rgba(148,163,184,0.08)" points="${polygonPoints(room.polygon)}" stroke="rgba(148,163,184,0.25)" stroke-width="0.12" />`
      );
      continue;
    }

    const fill = isAdded ? "rgba(56,189,248,0.28)" : "rgba(52,211,153,0.24)";
    const stroke = isAdded ? "#38bdf8" : "#10b981";
    const [x, y] = centroid(room.polygon);

    parts.push(`<g>`);
    parts.push(
      `<polygon fill="${fill}" points="${polygonPoints(room.polygon)}" stroke="${stroke}" stroke-width="0.22" />`
    );
    parts.push(`<text fill="#e2e8f0" font-size="1.4" text-anchor="middle" x="${x}" y="${y}">${escapeXml(room.name.split(" ")[0] ?? room.name)}</text>`);
    parts.push(`</g>`);
  }

  parts.push("</svg>");
  return parts.join("");
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
