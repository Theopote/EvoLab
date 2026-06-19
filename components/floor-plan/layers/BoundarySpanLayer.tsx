"use client";

import { useMemo } from "react";
import type { Room } from "@/lib/project-types";
import {
  buildBoundarySpan,
  spanVertexIndices,
  type BoundarySpanSelection
} from "@/lib/boundary-span-select";
import { polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import { useLocalFormEditStore } from "@/lib/local-form-edit-store";

interface BoundarySpanLayerProps {
  room?: Room;
  enabled: boolean;
}

export function BoundarySpanLayer({ room, enabled }: BoundarySpanLayerProps) {
  const pendingStartVertex = useLocalFormEditStore((state) => state.pendingStartVertex);
  const boundarySpan = useLocalFormEditStore((state) => state.boundarySpan);
  const setPendingStartVertex = useLocalFormEditStore((state) => state.setPendingStartVertex);
  const setBoundarySpan = useLocalFormEditStore((state) => state.setBoundarySpan);

  const spanOverlay = useMemo(() => {
    if (!room || !boundarySpan) {
      return undefined;
    }

    const indices = spanVertexIndices(
      room.polygon.length,
      boundarySpan.startVertexIndex,
      boundarySpan.endVertexIndex,
      boundarySpan.useLongArc
    );

    return indices.map((index) => room.polygon[index]);
  }, [boundarySpan, room]);

  function handlePointerDown(event: React.PointerEvent<SVGCircleElement>, vertexIndex: number) {
    if (!enabled || !room) {
      return;
    }

    event.stopPropagation();

    if (pendingStartVertex === undefined) {
      setPendingStartVertex(vertexIndex);
      return;
    }

    const span = buildBoundarySpan(room, pendingStartVertex, vertexIndex, event.shiftKey);

    if (span) {
      setBoundarySpan(span);
    }
  }

  if (!enabled || !room) {
    return null;
  }

  return (
    <g data-layer="boundary-span">
      {spanOverlay ? (
        <>
          <polyline
            fill="none"
            points={polygonPoints(spanOverlay)}
            stroke="#38bdf8"
            strokeDasharray="0.6 0.35"
            strokeWidth="0.35"
          />
          <circle cx={boundarySpan?.anchorBefore[0]} cy={boundarySpan?.anchorBefore[1]} fill="#94a3b8" r="0.42" />
          <circle cx={boundarySpan?.anchorAfter[0]} cy={boundarySpan?.anchorAfter[1]} fill="#94a3b8" r="0.42" />
        </>
      ) : null}
      {room.polygon.map(([x, y], index) => {
        const isPending = pendingStartVertex === index;
        const isAnchor =
          boundarySpan &&
          (pointsEqual([x, y], boundarySpan.anchorBefore) || pointsEqual([x, y], boundarySpan.anchorAfter));

        return (
          <circle
            key={`boundary-span-${index}`}
            cx={x}
            cy={y}
            fill={isPending ? "#f59e0b" : isAnchor ? "#94a3b8" : "#38bdf8"}
            r={isPending ? 0.5 : 0.38}
            stroke="#e2e8f0"
            strokeWidth="0.12"
            style={{ cursor: "pointer" }}
            onPointerDown={(event) => handlePointerDown(event, index)}
          />
        );
      })}
    </g>
  );
}

function pointsEqual(a: BoundarySpanSelection["anchorBefore"], b: BoundarySpanSelection["anchorBefore"]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05;
}
