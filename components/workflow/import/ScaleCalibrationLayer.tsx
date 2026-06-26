"use client";

import type { RefObject } from "react";
import { clientToSvgPoint } from "@/components/floor-plan/floor-plan-utils";
import type { Point } from "@/lib/project-types";

interface ScaleCalibrationLayerProps {
  svgRef: RefObject<SVGSVGElement | null>;
  enabled: boolean;
  overlayWidth: number;
  overlayHeight: number;
  points: Point[];
  onPointAdd: (point: Point) => void;
}

export function ScaleCalibrationLayer({
  svgRef,
  enabled,
  overlayWidth,
  overlayHeight,
  points,
  onPointAdd
}: ScaleCalibrationLayerProps) {
  if (!enabled) {
    return null;
  }

  function handleClick(event: React.MouseEvent<SVGRectElement>) {
    const svg = svgRef.current;
    if (!svg || points.length >= 2) {
      return;
    }

    const point = clientToSvgPoint(svg, event.clientX, event.clientY);
    onPointAdd(point);
  }

  return (
    <g data-layer="scale-calibration">
      <rect
        fill="transparent"
        height={overlayHeight}
        style={{ cursor: "crosshair" }}
        width={overlayWidth}
        x={-8}
        y={-8}
        onClick={handleClick}
      />
      {points.map((point, index) => (
        <g key={`${point[0]}-${point[1]}-${index}`}>
          <circle cx={point[0]} cy={point[1]} fill="#fbbf24" r="0.55" stroke="#081018" strokeWidth="0.12" />
          <text fill="#fde68a" fontSize="1.4" textAnchor="middle" x={point[0]} y={point[1] - 1.2}>
            {index + 1}
          </text>
        </g>
      ))}
      {points.length === 2 ? (
        <line
          stroke="#fbbf24"
          strokeDasharray="0.6 0.4"
          strokeWidth="0.25"
          x1={points[0]![0]}
          x2={points[1]![0]}
          y1={points[0]![1]}
          y2={points[1]![1]}
        />
      ) : null}
    </g>
  );
}
