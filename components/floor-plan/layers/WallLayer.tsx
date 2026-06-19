"use client";

import { useRef } from "react";
import type { Point, Room, Wall } from "@/lib/project-types";
import {
  createWallDragSession,
  isWallDragAllowed,
  previewWallDrag,
  wallDragOffsetFromPointer,
  type WallDragSession
} from "@/components/floor-plan/wall-drag-utils";
import type { GridSnapStep } from "@/lib/plan-snap";

interface WallLayerProps {
  walls: Wall[];
  rooms: Room[];
  selectedWallId?: string;
  hoveredWallId?: string;
  wallDragEnabled?: boolean;
  lockedElementIds?: string[];
  gridStep?: GridSnapStep;
  gridSnapEnabled?: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  onSelectWall?: (wallId: string) => void;
  onRoomsGeometryPreview?: (rooms: Room[], dragHint?: string | null) => void;
  onRoomsGeometryCommit?: (rooms: Room[]) => void;
  onRoomsGeometryCancel?: () => void;
}

export function WallLayer({
  walls,
  rooms,
  selectedWallId,
  hoveredWallId,
  wallDragEnabled = false,
  lockedElementIds = [],
  gridStep = 0.1,
  gridSnapEnabled = true,
  svgRef,
  onSelectWall,
  onRoomsGeometryPreview,
  onRoomsGeometryCommit,
  onRoomsGeometryCancel
}: WallLayerProps) {
  const sessionRef = useRef<WallDragSession | null>(null);

  function wallDraggable(wall: Wall) {
    return wallDragEnabled && isWallDragAllowed(wall, lockedElementIds);
  }

  function handlePointerMove(event: React.PointerEvent<SVGLineElement>) {
    const session = sessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const svgElement = svgRef?.current ?? event.currentTarget.ownerSVGElement;

    if (!svgElement) {
      return;
    }

    const offset = wallDragOffsetFromPointer(event, session, svgElement, gridSnapEnabled, gridStep);
    onRoomsGeometryPreview?.(previewWallDrag(session, offset), "Drag wall line · release to commit");
  }

  function endDrag(event: React.PointerEvent<SVGLineElement>) {
    const session = sessionRef.current;

    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const svgElement = svgRef?.current ?? event.currentTarget.ownerSVGElement;

    if (svgElement) {
      const offset = wallDragOffsetFromPointer(event, session, svgElement, gridSnapEnabled, gridStep);
      onRoomsGeometryCommit?.(previewWallDrag(session, offset));
    } else {
      onRoomsGeometryCancel?.();
    }

    sessionRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <g data-layer="walls">
      {walls.map((wall) => {
        const selected = wall.id === selectedWallId;
        const hovered = wall.id === hoveredWallId;
        const draggable = wallDraggable(wall);

        return (
          <g key={wall.id}>
            <line
              x1={wall.start[0]}
              y1={wall.start[1]}
              x2={wall.end[0]}
              y2={wall.end[1]}
              stroke="transparent"
              strokeLinecap="square"
              strokeWidth={Math.max(0.75, wall.thickness + 0.45)}
              className={draggable ? "cursor-grab" : onSelectWall ? "cursor-pointer" : undefined}
              onClick={(event) => {
                event.stopPropagation();
                onSelectWall?.(wall.id);
              }}
              onPointerCancel={() => {
                sessionRef.current = null;
                onRoomsGeometryCancel?.();
              }}
              onPointerDown={(event) => {
                if (!draggable || !onRoomsGeometryPreview || !onRoomsGeometryCommit) {
                  return;
                }

                const session = createWallDragSession(event, wall, rooms);

                if (!session) {
                  return;
                }

                onSelectWall?.(wall.id);
                sessionRef.current = session;
                onRoomsGeometryPreview(rooms, "Drag wall line · release to commit");
                event.currentTarget.setPointerCapture(event.pointerId);
                event.stopPropagation();
              }}
              onPointerMove={handlePointerMove}
              onPointerUp={endDrag}
            />
            <line
              x1={wall.start[0]}
              y1={wall.start[1]}
              x2={wall.end[0]}
              y2={wall.end[1]}
              stroke={
                selected ? "#e2e8f0" : hovered ? "#7dd3fc" : wall.type === "external" ? "#e5f6ff" : wall.type === "core" ? "#f0b35b" : "#7d8fa3"
              }
              strokeLinecap="square"
              strokeWidth={Math.max(0.18, wall.thickness + (hovered || selected ? 0.06 : 0))}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}
