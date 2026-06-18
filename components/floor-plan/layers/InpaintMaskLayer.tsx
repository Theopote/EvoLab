"use client";

import type { RefObject } from "react";
import type { PlanVersion, Point } from "@/lib/project-types";
import { clientToSvgPoint, polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import { useInpaintMaskStore } from "@/lib/inpaint-mask-store";

interface InpaintMaskLayerProps {
  svgRef: RefObject<SVGSVGElement | null>;
  version: PlanVersion;
  enabled: boolean;
}

export function InpaintMaskLayer({ svgRef, version, enabled }: InpaintMaskLayerProps) {
  const strokes = useInpaintMaskStore((state) => state.strokes);
  const activeStroke = useInpaintMaskStore((state) => state.activeStroke);
  const beginStroke = useInpaintMaskStore((state) => state.beginStroke);
  const extendStroke = useInpaintMaskStore((state) => state.extendStroke);
  const endStroke = useInpaintMaskStore((state) => state.endStroke);

  if (!enabled) {
    return null;
  }

  const padding = 8;
  const overlayWidth = version.overallBounds.width + padding * 2;
  const overlayHeight = version.overallBounds.height + padding * 2;

  function toSvgPoint(event: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;

    if (!svg) {
      return null;
    }

    return clientToSvgPoint(svg, event.clientX, event.clientY);
  }

  return (
    <g data-layer="inpaint-mask">
      {strokes.map((stroke, index) => (
        <polyline
          key={`stroke-${index}`}
          points={polygonPoints(stroke)}
          fill="none"
          stroke="rgba(250,204,21,0.55)"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {activeStroke.length ? (
        <polyline
          points={polygonPoints(activeStroke)}
          fill="none"
          stroke="#facc15"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <rect
        fill="transparent"
        height={overlayHeight}
        width={overlayWidth}
        x={-padding}
        y={-padding}
        style={{ cursor: "crosshair" }}
        onPointerDown={(event) => {
          const point = toSvgPoint(event);

          if (!point) {
            return;
          }

          beginStroke(point);
          event.currentTarget.setPointerCapture(event.pointerId);
          event.stopPropagation();
        }}
        onPointerMove={(event) => {
          const point = toSvgPoint(event);

          if (!point || activeStroke.length === 0) {
            return;
          }

          extendStroke(point);
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          endStroke();
        }}
        onPointerCancel={endStroke}
      />
    </g>
  );
}
