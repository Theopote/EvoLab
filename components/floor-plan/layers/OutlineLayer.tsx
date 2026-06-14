import type { PlanVersion } from "@/lib/project-types";
import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import type { SetbackBoundary } from "@/lib/polygon-offset";

interface OutlineLayerProps {
  version: PlanVersion;
  setback?: SetbackBoundary;
}

export function OutlineLayer({ version, setback }: OutlineLayerProps) {
  return (
    <g data-layer="outline">
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
