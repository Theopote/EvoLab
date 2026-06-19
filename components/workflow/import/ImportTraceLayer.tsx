"use client";

import type { RefObject } from "react";
import { useState } from "react";
import { clientToSvgPoint, polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import { processStrokeGhost } from "@/lib/sketch-processing";
import type { Point } from "@/lib/project-types";

interface ImportTraceLayerProps {
  svgRef: RefObject<SVGSVGElement | null>;
  enabled: boolean;
  overlayWidth: number;
  overlayHeight: number;
  onCompletePolygon: (polygon: Point[]) => void;
}

const MIN_TRACE_AREA_SQM = 1.5;

export function ImportTraceLayer({
  svgRef,
  enabled,
  overlayWidth,
  overlayHeight,
  onCompletePolygon
}: ImportTraceLayerProps) {
  const [activeStroke, setActiveStroke] = useState<Point[]>([]);

  if (!enabled) {
    return null;
  }

  function toSvgPoint(event: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;

    if (!svg) {
      return null;
    }

    return clientToSvgPoint(svg, event.clientX, event.clientY);
  }

  function finishStroke(stroke: Point[]) {
    const polygon = processStrokeGhost(stroke);

    if (polygon.length < 3) {
      setActiveStroke([]);
      return;
    }

    const area =
      Math.abs(
        polygon.reduce((sum, point, index) => {
          const next = polygon[(index + 1) % polygon.length];
          return sum + point[0] * next[1] - next[0] * point[1];
        }, 0) / 2
      );

    if (area < MIN_TRACE_AREA_SQM) {
      setActiveStroke([]);
      return;
    }

    onCompletePolygon(polygon);
    setActiveStroke([]);
  }

  return (
    <g data-layer="import-trace">
      {activeStroke.length ? (
        <polyline
          points={polygonPoints(activeStroke)}
          fill="rgba(94,234,212,0.12)"
          stroke="#5eead4"
          strokeDasharray="0.8 0.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="0.45"
        />
      ) : null}
      {activeStroke.map((point, index) => (
        <circle key={`trace-point-${index}`} cx={point[0]} cy={point[1]} fill="#5eead4" r="0.35" />
      ))}
      <rect
        fill="transparent"
        height={overlayHeight}
        style={{ cursor: "crosshair", touchAction: "none" }}
        width={overlayWidth}
        x={-8}
        y={-8}
        onDoubleClick={() => finishStroke(activeStroke)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = toSvgPoint(event);

          if (!point) {
            return;
          }

          setActiveStroke((current) => [...current, point]);
        }}
      />
    </g>
  );
}
