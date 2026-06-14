import type { PlanVersion } from "@/lib/project-types";
import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";

interface OutlineLayerProps {
  version: PlanVersion;
}

export function OutlineLayer({ version }: OutlineLayerProps) {
  const grid = version.building.grids[0];

  return (
    <g data-layer="outline">
      {grid?.lines.map((line) => (
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
      <polygon
        points={polygonPoints(version.outline)}
        fill="rgba(255,255,255,0.018)"
        stroke="#d8edf5"
        strokeWidth="0.35"
      />
      <text x={version.overallBounds.width / 2} y={-3.2} fill="#9fb3c8" fontSize="1.25" textAnchor="middle">
        {Math.round(version.overallBounds.width * 10) / 10} m
      </text>
      <text
        x={version.overallBounds.width + 3.2}
        y={version.overallBounds.height / 2}
        fill="#9fb3c8"
        fontSize="1.25"
        textAnchor="middle"
        transform={`rotate(90 ${version.overallBounds.width + 3.2} ${version.overallBounds.height / 2})`}
      >
        {Math.round(version.overallBounds.height * 10) / 10} m
      </text>
    </g>
  );
}
