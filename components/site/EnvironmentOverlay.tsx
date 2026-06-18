import type { EnvironmentSurrogate } from "@/lib/site-types";

function sunColor(value: number) {
  const ratio = Math.max(0, Math.min(1, value / 8));
  const red = Math.round(30 + ratio * 220);
  const green = Math.round(50 + ratio * 170);
  return `rgba(${red}, ${green}, 40, 0.34)`;
}

function windColor(value: number) {
  const ratio = Math.max(0, Math.min(1, value));
  return `rgba(56, 189, 248, ${0.12 + ratio * 0.35})`;
}

export function EnvironmentOverlay({
  surrogate,
  width,
  height,
  minX,
  minY,
  mode
}: {
  surrogate?: EnvironmentSurrogate;
  width: number;
  height: number;
  minX: number;
  minY: number;
  mode: "sun" | "wind";
}) {
  if (!surrogate?.cells.length) {
    return null;
  }

  const cellWidth = width / surrogate.gridSize;
  const cellHeight = height / surrogate.gridSize;

  return (
    <g data-layer="environment-surrogate" opacity="0.95">
      {surrogate.cells.map((cell, index) => (
        <rect
          key={`${mode}-${index}`}
          x={cell.x - cellWidth / 2}
          y={cell.y - cellHeight / 2}
          width={cellWidth}
          height={cellHeight}
          fill={mode === "sun" ? sunColor(cell.sunHours) : windColor(cell.windShelter)}
          stroke="none"
        />
      ))}
    </g>
  );
}
