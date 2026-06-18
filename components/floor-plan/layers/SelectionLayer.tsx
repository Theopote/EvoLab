"use client";

import { useRef } from "react";
import type { OpeningElement, Point, Room, Wall } from "@/lib/project-types";
import { clientToSvgPoint, openingSegment, polygonPoints, snapPlanCoordinate } from "@/components/floor-plan/floor-plan-utils";

const VERTEX_R = 0.55;
const MIDPOINT_R = 0.38;

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function ControlPoints({
  polygon,
  traceEnabled,
  svgRef,
  onVertexMove
}: {
  polygon: Point[];
  traceEnabled: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  onVertexMove?: (vertexIndex: number, point: Point) => void;
}) {
  const dragIndexRef = useRef<number | null>(null);

  function handlePointerMove(event: React.PointerEvent<SVGCircleElement>) {
    const svgElement = svgRef?.current;

    if (dragIndexRef.current === null || !svgElement || !onVertexMove) {
      return;
    }

    const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);
    onVertexMove(dragIndexRef.current, [snapPlanCoordinate(x), snapPlanCoordinate(y)]);
  }

  function endDrag() {
    dragIndexRef.current = null;
  }

  const vertices = polygon;
  const midpoints: Point[] = polygon.map((pt, i) => midpoint(pt, polygon[(i + 1) % polygon.length]));

  return (
    <g data-layer="control-points">
      {midpoints.map(([x, y], i) => (
        <circle
          key={`mp-${i}`}
          cx={x}
          cy={y}
          r={MIDPOINT_R}
          fill="#0d1c29"
          stroke="#4fb5c8"
          strokeWidth="0.14"
        />
      ))}
      {vertices.map(([x, y], i) => (
        <circle
          key={`vt-${i}`}
          cx={x}
          cy={y}
          r={VERTEX_R}
          fill="#4fb5c8"
          stroke="#e2e8f0"
          strokeWidth="0.16"
          style={{ cursor: traceEnabled ? "grab" : "default" }}
          onPointerDown={(event) => {
            if (!traceEnabled || !onVertexMove) {
              return;
            }

            dragIndexRef.current = i;
            event.currentTarget.setPointerCapture(event.pointerId);
            event.stopPropagation();
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            endDrag();
          }}
          onPointerCancel={endDrag}
        />
      ))}
    </g>
  );
}

interface SelectionLayerProps {
  rooms: Room[];
  walls: Wall[];
  openings: OpeningElement[];
  selectedRoomId?: string;
  selectedWallId?: string;
  selectedOpeningId?: string;
  traceEnabled?: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  onRoomPolygonChange?: (roomId: string, polygon: Point[]) => void;
}

export function SelectionLayer({
  rooms,
  walls,
  openings,
  selectedRoomId,
  selectedWallId,
  selectedOpeningId,
  traceEnabled = false,
  svgRef,
  onRoomPolygonChange
}: SelectionLayerProps) {
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const selectedWall = walls.find((wall) => wall.id === selectedWallId);
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId);
  const selectedOpeningWall = selectedOpening ? walls.find((wall) => wall.id === selectedOpening.wallId) : undefined;

  if (!selectedRoom && !selectedWall && !selectedOpening) {
    return null;
  }

  const openingSelection = selectedOpening && selectedOpeningWall ? openingSegment(selectedOpening, selectedOpeningWall) : undefined;

  return (
    <g data-layer="selection">
      {selectedRoom ? (
        <>
          <polygon
            points={polygonPoints(selectedRoom.polygon)}
            fill="rgba(79,181,200,0.08)"
            stroke="#4fb5c8"
            strokeDasharray="0.8 0.45"
            strokeWidth="0.45"
          />
          <ControlPoints
            polygon={selectedRoom.polygon}
            traceEnabled={traceEnabled}
            svgRef={svgRef}
            onVertexMove={(vertexIndex, point) => {
              if (!onRoomPolygonChange) {
                return;
              }

              const nextPolygon = selectedRoom.polygon.map((vertex, index) =>
                index === vertexIndex ? point : vertex
              );
              onRoomPolygonChange(selectedRoom.id, nextPolygon);
            }}
          />
        </>
      ) : null}

      {selectedWall ? (
        <line
          x1={selectedWall.start[0]}
          y1={selectedWall.start[1]}
          x2={selectedWall.end[0]}
          y2={selectedWall.end[1]}
          stroke="#f8fafc"
          strokeDasharray="0.5 0.35"
          strokeWidth={Math.max(0.42, selectedWall.thickness + 0.1)}
        />
      ) : null}

      {openingSelection ? (
        <line
          x1={openingSelection.start[0]}
          y1={openingSelection.start[1]}
          x2={openingSelection.end[0]}
          y2={openingSelection.end[1]}
          stroke="#fde68a"
          strokeWidth="0.42"
          strokeLinecap="round"
        />
      ) : null}
    </g>
  );
}
