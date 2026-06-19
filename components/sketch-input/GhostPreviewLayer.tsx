"use client";

import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import type { Point } from "@/lib/project-types";
import type { GhostLoop } from "@/lib/sketch-input-store";

interface GhostPreviewLayerProps {
  ghostLoops: GhostLoop[];
  activeGhostPolygon?: Point[];
}

export function GhostPreviewLayer({ ghostLoops, activeGhostPolygon }: GhostPreviewLayerProps) {
  return (
    <g data-layer="sketch-ghost-preview">
      {ghostLoops.map((loop) => (
        <polygon
          key={loop.id}
          points={polygonPoints([...loop.polygon, loop.polygon[0]])}
          fill="rgba(79,181,200,0.08)"
          stroke="rgba(79,181,200,0.55)"
          strokeDasharray="0.6 0.35"
          strokeWidth="0.35"
        />
      ))}
      {activeGhostPolygon && activeGhostPolygon.length >= 3 ? (
        <polygon
          points={polygonPoints([...activeGhostPolygon, activeGhostPolygon[0]])}
          fill="rgba(79,181,200,0.12)"
          stroke="rgba(125,211,252,0.8)"
          strokeDasharray="0.4 0.25"
          strokeWidth="0.4"
        />
      ) : null}
    </g>
  );
}
