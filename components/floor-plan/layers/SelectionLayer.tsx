"use client";

import { useMemo, useRef } from "react";
import type { OpeningElement, Point, Room, Wall } from "@/lib/project-types";
import { clientToSvgPoint, openingSegment, polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import { openingCenterFromDragPoint } from "@/lib/opening-wall-utils";
import {
  applyNodeDrag,
  applyWallDragByOffset,
  deriveWallGraph,
  edgeUnitNormal,
  findRoomEdge,
  quantizePoint,
  roomsAtNode
} from "@/lib/wall-graph";
import {
  constrainOrthoDelta,
  projectDeltaOntoNormal,
  snapPoint,
  wallUnitNormal,
  type GridSnapStep
} from "@/lib/plan-snap";

const VERTEX_R = 0.55;
const MIDPOINT_R = 0.38;

function midpoint(a: Point, b: Point): Point {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

interface GeometryDragSession {
  pointerId: number;
  dragStart: Point;
  originalRooms: Room[];
  anchor?: Point;
  nodeId?: string;
  wallId?: string;
  wallNormal?: Point;
}

function ControlPoints({
  polygon,
  roomId,
  geometryEditEnabled,
  allRooms,
  svgRef,
  gridStep,
  gridEnabled,
  onPreviewRooms,
  onCommitRooms,
  onCancelPreview
}: {
  polygon: Point[];
  roomId: string;
  geometryEditEnabled: boolean;
  allRooms: Room[];
  svgRef?: React.RefObject<SVGSVGElement | null>;
  gridStep: GridSnapStep;
  gridEnabled: boolean;
  onPreviewRooms?: (rooms: Room[]) => void;
  onCommitRooms?: (rooms: Room[]) => void;
  onCancelPreview?: () => void;
}) {
  const sessionRef = useRef<GeometryDragSession | null>(null);
  const graph = useMemo(() => deriveWallGraph(allRooms), [allRooms]);
  const endpointTargets = graph.nodes.map((node) => node.position);

  function toSnappedPoint(event: React.PointerEvent<SVGCircleElement>, origin?: Point) {
    const svgElement = svgRef?.current;

    if (!svgElement) {
      return null;
    }

    const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);
    const raw: Point = [x, y];
    const ortho = origin ? constrainOrthoDelta(origin, raw) : raw;
    const next: Point = [origin ? origin[0] + ortho[0] : raw[0], origin ? origin[1] + ortho[1] : raw[1]];

    return snapPoint(next, {
      gridEnabled,
      gridStep,
      endpointTargets
    });
  }

  function handlePointerMove(event: React.PointerEvent<SVGCircleElement>) {
    const session = sessionRef.current;

    if (!session || session.pointerId !== event.pointerId || !session.nodeId) {
      return;
    }

    const next = toSnappedPoint(event, session.dragStart);

    if (!next) {
      return;
    }

    onPreviewRooms?.(applyNodeDrag(session.originalRooms, graph, session.nodeId, next));
  }

  const midpoints: Point[] = polygon.map((point, index) => midpoint(point, polygon[(index + 1) % polygon.length]));

  return (
    <g data-layer="control-points">
      {midpoints.map(([x, y], index) => {
        const edge = findRoomEdge(graph, roomId, index);

        if (!edge || !geometryEditEnabled) {
          return (
            <circle
              key={`mp-${index}`}
              cx={x}
              cy={y}
              r={MIDPOINT_R}
              fill="#0d1c29"
              stroke="#4fb5c8"
              strokeWidth="0.14"
            />
          );
        }

        return (
          <EdgeMidpointHandle
            key={`mp-${index}`}
            allRooms={allRooms}
            center={[x, y]}
            edge={edge}
            enabled={geometryEditEnabled}
            gridEnabled={gridEnabled}
            gridStep={gridStep}
            svgRef={svgRef}
            onCancelPreview={onCancelPreview}
            onCommitRooms={onCommitRooms}
            onPreviewRooms={onPreviewRooms}
          />
        );
      })}
      {polygon.map(([x, y], index) => {
        const nodeId = quantizePoint([x, y]);
        const shared = roomsAtNode(graph, nodeId).length > 1;

        return (
          <circle
            key={`vt-${index}`}
            cx={x}
            cy={y}
            r={VERTEX_R}
            fill={shared ? "#f59e0b" : "#4fb5c8"}
            stroke={shared ? "#fde68a" : "#e2e8f0"}
            strokeWidth="0.16"
            style={{ cursor: geometryEditEnabled ? "grab" : "default" }}
            onPointerDown={(event) => {
              if (!geometryEditEnabled || !onPreviewRooms || !onCommitRooms) {
                return;
              }

              sessionRef.current = {
                pointerId: event.pointerId,
                dragStart: [x, y],
                originalRooms: allRooms,
                anchor: [x, y],
                nodeId
              };
              onPreviewRooms(allRooms);
              event.currentTarget.setPointerCapture(event.pointerId);
              event.stopPropagation();
            }}
            onPointerMove={handlePointerMove}
            onPointerUp={(event) => {
              if (sessionRef.current?.pointerId !== event.pointerId) {
                return;
              }

              const session = sessionRef.current;
              const next = toSnappedPoint(event, session?.dragStart);

              if (session?.nodeId && next) {
                onCommitRooms?.(applyNodeDrag(session.originalRooms, graph, session.nodeId, next));
              } else {
                onCancelPreview?.();
              }

              sessionRef.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              sessionRef.current = null;
              onCancelPreview?.();
            }}
          />
        );
      })}
    </g>
  );
}

function EdgeMidpointHandle({
  center,
  edge,
  allRooms,
  svgRef,
  enabled,
  gridStep,
  gridEnabled,
  onPreviewRooms,
  onCommitRooms,
  onCancelPreview
}: {
  center: Point;
  edge: ReturnType<typeof deriveWallGraph>["edges"][number];
  allRooms: Room[];
  svgRef?: React.RefObject<SVGSVGElement | null>;
  enabled: boolean;
  gridStep: GridSnapStep;
  gridEnabled: boolean;
  onPreviewRooms?: (rooms: Room[]) => void;
  onCommitRooms?: (rooms: Room[]) => void;
  onCancelPreview?: () => void;
}) {
  const sessionRef = useRef<GeometryDragSession | null>(null);
  const normal = edgeUnitNormal(edge.nodeA, edge.nodeB);

  function currentOffset(event: React.PointerEvent<SVGCircleElement>) {
    const session = sessionRef.current;
    const svgElement = svgRef?.current;

    if (!session || !svgElement) {
      return null;
    }

    const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);
    const rawDelta: Point = [x - session.dragStart[0], y - session.dragStart[1]];
    const projected = projectDeltaOntoNormal(rawDelta, session.wallNormal ?? normal);
    const nextPoint = snapPoint([session.dragStart[0] + projected[0], session.dragStart[1] + projected[1]], {
      gridEnabled,
      gridStep
    });
    const snappedDelta: Point = [nextPoint[0] - session.dragStart[0], nextPoint[1] - session.dragStart[1]];

    return snappedDelta[0] * normal[0] + snappedDelta[1] * normal[1];
  }

  return (
    <circle
      cx={center[0]}
      cy={center[1]}
      r={MIDPOINT_R}
      fill="#0d1c29"
      stroke="#38bdf8"
      strokeWidth="0.16"
      style={{ cursor: enabled ? "grab" : "default" }}
      onPointerDown={(event) => {
        if (!enabled || !onPreviewRooms || !onCommitRooms) {
          return;
        }

        const svgElement = svgRef?.current;

        if (!svgElement) {
          return;
        }

        const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);

        sessionRef.current = {
          pointerId: event.pointerId,
          dragStart: [x, y],
          originalRooms: allRooms,
          wallId: edge.id,
          wallNormal: normal
        };
        onPreviewRooms(allRooms);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.stopPropagation();
      }}
      onPointerMove={(event) => {
        const session = sessionRef.current;

        if (!session || session.pointerId !== event.pointerId || !session.wallId) {
          return;
        }

        const offset = currentOffset(event);

        if (offset === null) {
          return;
        }

        onPreviewRooms?.(
          applyWallDragByOffset(session.originalRooms, session.wallId, offset, session.wallNormal ?? normal)
        );
      }}
      onPointerUp={(event) => {
        const session = sessionRef.current;

        if (!session || session.pointerId !== event.pointerId || !session.wallId) {
          return;
        }

        const offset = currentOffset(event);

        if (offset !== null) {
          onCommitRooms?.(
            applyWallDragByOffset(session.originalRooms, session.wallId, offset, session.wallNormal ?? normal)
          );
        } else {
          onCancelPreview?.();
        }

        sessionRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        sessionRef.current = null;
        onCancelPreview?.();
      }}
    />
  );
}

function WallDragHandle({
  wall,
  allRooms,
  svgRef,
  enabled,
  gridStep,
  gridEnabled,
  onPreviewRooms,
  onCommitRooms,
  onCancelPreview
}: {
  wall: Wall;
  allRooms: Room[];
  svgRef?: React.RefObject<SVGSVGElement | null>;
  enabled: boolean;
  gridStep: GridSnapStep;
  gridEnabled: boolean;
  onPreviewRooms?: (rooms: Room[]) => void;
  onCommitRooms?: (rooms: Room[]) => void;
  onCancelPreview?: () => void;
}) {
  const sessionRef = useRef<GeometryDragSession | null>(null);
  const center = midpoint(wall.start, wall.end);
  const normal = wallUnitNormal(wall);

  function currentOffset(event: React.PointerEvent<SVGCircleElement>) {
    const session = sessionRef.current;
    const svgElement = svgRef?.current;

    if (!session || !svgElement) {
      return null;
    }

    const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);
    const rawDelta: Point = [x - session.dragStart[0], y - session.dragStart[1]];
    const projected = projectDeltaOntoNormal(rawDelta, session.wallNormal ?? normal);
    const nextPoint = snapPoint([session.dragStart[0] + projected[0], session.dragStart[1] + projected[1]], {
      gridEnabled,
      gridStep
    });
    const snappedDelta: Point = [nextPoint[0] - session.dragStart[0], nextPoint[1] - session.dragStart[1]];

    return snappedDelta[0] * normal[0] + snappedDelta[1] * normal[1];
  }

  return (
    <circle
      cx={center[0]}
      cy={center[1]}
      r={0.62}
      fill="#f8fafc"
      stroke="#38bdf8"
      strokeWidth="0.18"
      style={{ cursor: enabled ? "grab" : "default" }}
      onPointerDown={(event) => {
        if (!enabled || !onPreviewRooms || !onCommitRooms) {
          return;
        }

        const svgElement = svgRef?.current;

        if (!svgElement) {
          return;
        }

        const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);

        sessionRef.current = {
          pointerId: event.pointerId,
          dragStart: [x, y],
          originalRooms: allRooms,
          wallId: wall.id,
          wallNormal: normal
        };
        onPreviewRooms(allRooms);
        event.currentTarget.setPointerCapture(event.pointerId);
        event.stopPropagation();
      }}
      onPointerMove={(event) => {
        const session = sessionRef.current;

        if (!session || session.pointerId !== event.pointerId || !session.wallId) {
          return;
        }

        const offset = currentOffset(event);

        if (offset === null) {
          return;
        }

        onPreviewRooms?.(
          applyWallDragByOffset(session.originalRooms, session.wallId, offset, session.wallNormal ?? normal)
        );
      }}
      onPointerUp={(event) => {
        const session = sessionRef.current;

        if (!session || session.pointerId !== event.pointerId || !session.wallId) {
          return;
        }

        const offset = currentOffset(event);

        if (offset !== null) {
          onCommitRooms?.(
            applyWallDragByOffset(session.originalRooms, session.wallId, offset, session.wallNormal ?? normal)
          );
        } else {
          onCancelPreview?.();
        }

        sessionRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        sessionRef.current = null;
        onCancelPreview?.();
      }}
    />
  );
}

function OpeningPositionHandle({
  opening,
  wall,
  svgRef,
  enabled,
  onCenterChange
}: {
  opening: OpeningElement;
  wall: Wall;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  enabled: boolean;
  onCenterChange?: (openingId: string, center: Point) => void;
}) {
  const draggingRef = useRef(false);

  function handlePointerMove(event: React.PointerEvent<SVGCircleElement>) {
    const svgElement = svgRef?.current;

    if (!draggingRef.current || !svgElement || !onCenterChange) {
      return;
    }

    const [x, y] = clientToSvgPoint(svgElement, event.clientX, event.clientY);
    const nextCenter = openingCenterFromDragPoint(
      wall,
      opening.width,
      snapPoint([x, y], { gridEnabled: true, gridStep: 0.1 })
    );

    if (!nextCenter) {
      return;
    }

    onCenterChange(opening.id, nextCenter);
  }

  function endDrag() {
    draggingRef.current = false;
  }

  return (
    <circle
      cx={opening.center[0]}
      cy={opening.center[1]}
      r={0.55}
      fill="#fde68a"
      stroke="#f59e0b"
      strokeWidth="0.16"
      style={{ cursor: enabled ? "grab" : "default" }}
      onPointerDown={(event) => {
        if (!enabled || !onCenterChange) {
          return;
        }

        draggingRef.current = true;
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
  );
}

interface SelectionLayerProps {
  rooms: Room[];
  walls: Wall[];
  openings: OpeningElement[];
  selectedRoomId?: string;
  selectedWallId?: string;
  selectedOpeningId?: string;
  geometryEditEnabled?: boolean;
  wallDragEnabled?: boolean;
  openingEditEnabled?: boolean;
  gridStep?: GridSnapStep;
  gridSnapEnabled?: boolean;
  svgRef?: React.RefObject<SVGSVGElement | null>;
  onRoomsGeometryPreview?: (rooms: Room[]) => void;
  onRoomsGeometryCommit?: (rooms: Room[]) => void;
  onRoomsGeometryCancel?: () => void;
  onOpeningCenterChange?: (openingId: string, center: Point) => void;
}

export function SelectionLayer({
  rooms,
  walls,
  openings,
  selectedRoomId,
  selectedWallId,
  selectedOpeningId,
  geometryEditEnabled = false,
  wallDragEnabled = false,
  openingEditEnabled = false,
  gridStep = 0.1,
  gridSnapEnabled = true,
  svgRef,
  onRoomsGeometryPreview,
  onRoomsGeometryCommit,
  onRoomsGeometryCancel,
  onOpeningCenterChange
}: SelectionLayerProps) {
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const selectedWall = walls.find((wall) => wall.id === selectedWallId);
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId);
  const selectedOpeningWall = selectedOpening ? walls.find((wall) => wall.id === selectedOpening.wallId) : undefined;

  if (!selectedRoom && !selectedWall && !selectedOpening) {
    return null;
  }

  const openingSelection =
    selectedOpening && selectedOpeningWall ? openingSegment(selectedOpening, selectedOpeningWall) : undefined;

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
            allRooms={rooms}
            geometryEditEnabled={geometryEditEnabled}
            gridEnabled={gridSnapEnabled}
            gridStep={gridStep}
            polygon={selectedRoom.polygon}
            roomId={selectedRoom.id}
            svgRef={svgRef}
            onCommitRooms={onRoomsGeometryCommit}
            onCancelPreview={onRoomsGeometryCancel}
            onPreviewRooms={onRoomsGeometryPreview}
          />
        </>
      ) : null}

      {selectedWall ? (
        <>
          <line
            x1={selectedWall.start[0]}
            y1={selectedWall.start[1]}
            x2={selectedWall.end[0]}
            y2={selectedWall.end[1]}
            stroke="#f8fafc"
            strokeDasharray="0.5 0.35"
            strokeWidth={Math.max(0.42, selectedWall.thickness + 0.1)}
          />
          <WallDragHandle
            allRooms={rooms}
            enabled={wallDragEnabled}
            gridEnabled={gridSnapEnabled}
            gridStep={gridStep}
            svgRef={svgRef}
            wall={selectedWall}
            onCommitRooms={onRoomsGeometryCommit}
            onCancelPreview={onRoomsGeometryCancel}
            onPreviewRooms={onRoomsGeometryPreview}
          />
        </>
      ) : null}

      {openingSelection ? (
        <>
          <line
            x1={openingSelection.start[0]}
            y1={openingSelection.start[1]}
            x2={openingSelection.end[0]}
            y2={openingSelection.end[1]}
            stroke="#fde68a"
            strokeWidth="0.42"
            strokeLinecap="round"
          />
          {selectedOpening && selectedOpeningWall ? (
            <OpeningPositionHandle
              enabled={openingEditEnabled}
              opening={selectedOpening}
              svgRef={svgRef}
              wall={selectedOpeningWall}
              onCenterChange={onOpeningCenterChange}
            />
          ) : null}
        </>
      ) : null}
    </g>
  );
}
