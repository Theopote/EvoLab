"use client";

import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import type { Point } from "@/lib/project-types";
import type { RecognizedSketchRoom } from "@/lib/schemas/sketch-interpretation-schema";
import type { GhostLoop } from "@/lib/sketch-input-store";

interface GhostPreviewLayerProps {
  ghostLoops: GhostLoop[];
  semanticByGhostId?: Record<string, RecognizedSketchRoom>;
  activeGhostPolygon?: Point[];
}

function polygonCentroid(polygon: Point[]): Point {
  const total = polygon.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as Point, [0, 0]);
  return [total[0] / polygon.length, total[1] / polygon.length];
}

export function GhostPreviewLayer({
  ghostLoops,
  semanticByGhostId = {},
  activeGhostPolygon
}: GhostPreviewLayerProps) {
  return (
    <g data-layer="sketch-ghost-preview">
      {ghostLoops.map((loop) => {
        const semantic = semanticByGhostId[loop.id];
        const [cx, cy] = polygonCentroid(loop.polygon);
        const needsReview = semantic?.confidence === "needs_review";

        return (
          <g key={loop.id}>
            <polygon
              points={polygonPoints([...loop.polygon, loop.polygon[0]])}
              fill={needsReview ? "rgba(251,146,60,0.08)" : "rgba(79,181,200,0.08)"}
              stroke={needsReview ? "rgba(251,146,60,0.65)" : "rgba(79,181,200,0.55)"}
              strokeDasharray={needsReview ? "0.7 0.4" : "0.6 0.35"}
              strokeWidth="0.35"
            />
            {semantic ? (
              <text fill={needsReview ? "#fb923c" : "#7dd3fc"} fontSize="1.1" textAnchor="middle" x={cx} y={cy}>
                {semantic.room.name}
              </text>
            ) : null}
          </g>
        );
      })}
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
