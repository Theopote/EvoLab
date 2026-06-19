import type { PlanVersion } from "@/lib/project-types";

export function buildVersionWallPreviewDataUrl(version: PlanVersion) {
  const walls = version.levels.flatMap((level) => level.walls);
  const width = version.overallBounds.width;
  const height = version.overallBounds.height;
  const wallMarkup = walls
    .map(
      (wall) =>
        `<line x1="${wall.start[0]}" y1="${wall.start[1]}" x2="${wall.end[0]}" y2="${wall.end[1]}" stroke="#cbd5e1" stroke-width="0.18" stroke-linecap="round" />`
    )
    .join("");
  const openingMarkup = version.levels
    .flatMap((level) => level.openings)
    .map(
      (opening) =>
        `<circle cx="${opening.center[0]}" cy="${opening.center[1]}" r="0.35" fill="none" stroke="#5eead4" stroke-width="0.12" />`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#0b1118" />
    ${wallMarkup}
    ${openingMarkup}
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
