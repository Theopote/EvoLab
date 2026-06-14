import type { PlanVersion } from "@/lib/project-types";

interface GridLayerProps {
  version: PlanVersion;
}

export function GridLayer({ version }: GridLayerProps) {
  const grid = version.building.grids[0];

  if (!grid?.lines.length) {
    return null;
  }

  return (
    <g data-layer="grid">
      {grid.lines.map((line) => (
        <g key={line.id}>
          <line
            x1={line.start[0]}
            y1={line.start[1]}
            x2={line.end[0]}
            y2={line.end[1]}
            stroke="rgba(159,179,200,0.18)"
            strokeDasharray="0.8 1.2"
            strokeWidth="0.08"
          />
          <text x={line.start[0] - 1.2} y={line.start[1] - 0.8} fill="#64748b" fontSize="1.1">
            {line.label}
          </text>
        </g>
      ))}
    </g>
  );
}
