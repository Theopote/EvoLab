"use client";

import type { RefObject } from "react";
import type { PlanVersion } from "@/lib/project-types";
import { clientToSvgPoint, polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import { GhostPreviewLayer } from "@/components/sketch-input/GhostPreviewLayer";
import { processStrokeGhost } from "@/lib/sketch-processing";
import { useSketchInputStore } from "@/lib/sketch-input-store";

interface SketchInputLayerProps {
  svgRef: RefObject<SVGSVGElement | null>;
  version: PlanVersion;
  enabled: boolean;
}

export function SketchInputLayer({ svgRef, version, enabled }: SketchInputLayerProps) {
  const strokes = useSketchInputStore((state) => state.strokes);
  const activeStroke = useSketchInputStore((state) => state.activeStroke);
  const ghostLoops = useSketchInputStore((state) => state.ghostLoops);
  const semanticByGhostId = useSketchInputStore((state) => state.semanticByGhostId);
  const beginStroke = useSketchInputStore((state) => state.beginStroke);
  const extendStroke = useSketchInputStore((state) => state.extendStroke);
  const endStroke = useSketchInputStore((state) => state.endStroke);

  if (!enabled) {
    return null;
  }

  const padding = 8;
  const overlayWidth = version.overallBounds.width + padding * 2;
  const overlayHeight = version.overallBounds.height + padding * 2;
  const activeGhostPolygon =
    activeStroke.length >= 3 ? processStrokeGhost(activeStroke) : activeStroke.length >= 2 ? activeStroke : undefined;

  function toSvgPoint(event: React.PointerEvent<SVGRectElement>) {
    const svg = svgRef.current;

    if (!svg) {
      return null;
    }

    return clientToSvgPoint(svg, event.clientX, event.clientY);
  }

  return (
    <g data-layer="sketch-input">
      <GhostPreviewLayer
        activeGhostPolygon={activeGhostPolygon}
        ghostLoops={ghostLoops}
        semanticByGhostId={semanticByGhostId}
      />
      {strokes.map((stroke, index) => (
        <polyline
          key={`sketch-stroke-${index}`}
          points={polygonPoints(stroke)}
          fill="none"
          stroke="rgba(226,232,240,0.85)"
          strokeWidth="0.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {activeStroke.length ? (
        <polyline
          points={polygonPoints(activeStroke)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="0.5"
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
        style={{ cursor: "crosshair", touchAction: "none" }}
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
