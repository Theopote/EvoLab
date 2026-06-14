import type { PlanVersion } from "@/lib/project-types";
import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import type { SetbackBoundary } from "@/lib/polygon-offset";

interface OutlineLayerProps {
  version: PlanVersion;
  setback?: SetbackBoundary;
}

export function OutlineLayer({ version, setback }: OutlineLayerProps) {
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
      {setback?.valid ? (
        <polygon
          points={polygonPoints(setback.buildable)}
          fill="rgba(132,204,22,0.035)"
          stroke="#84cc16"
          strokeDasharray="0.8 0.5"
          strokeWidth="0.2"
        />
      ) : null}
    </g>
  );
}
