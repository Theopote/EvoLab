"use client";

import { useRef } from "react";
import type { PlanVersion, Room, Wall } from "@/lib/project-types";
import { clientToSvgPoint, polygonPoints } from "@/components/floor-plan/floor-plan-utils";
import { buildBayWindowFootprint } from "@/lib/add-protrusion";
import { openingEdgeParamFromCenter } from "@/lib/opening-edge-utils";
import { useLocalFormEditStore } from "@/lib/local-form-edit-store";
import { hitTestWalls, type WallGraph } from "@/lib/wall-graph";

interface ProtrusionPlacementLayerProps {
  version: PlanVersion;
  rooms: Room[];
  walls: Wall[];
  wallGraph: WallGraph;
  enabled: boolean;
  widthM: number;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

export function ProtrusionPlacementLayer({
  rooms,
  walls,
  wallGraph,
  enabled,
  widthM,
  svgRef
}: ProtrusionPlacementLayerProps) {
  const placement = useLocalFormEditStore((state) => state.protrusionPlacement);
  const setProtrusionPlacement = useLocalFormEditStore((state) => state.setProtrusionPlacement);
  const dragRef = useRef<{ wallId: string; positionOnEdge: number } | null>(null);

  const previewWall = placement ? walls.find((wall) => wall.id === placement.wallId) : undefined;
  const hostRoom = previewWall
    ? rooms.find((room) => previewWall.roomIds.includes(room.id) && room.type !== "corridor")
    : undefined;
  const previewFootprint =
    previewWall && placement
      ? buildBayWindowFootprint(previewWall, placement.positionOnEdge, placement.widthM, 0.45)
      : [];

  function pickWall(event: React.PointerEvent) {
    if (!enabled || !svgRef.current) {
      return;
    }

    const [x, y] = clientToSvgPoint(svgRef.current, event.clientX, event.clientY);
    const hit = hitTestWalls([x, y], wallGraph);

    if (!hit) {
      return;
    }

    const wall = walls.find((item) => item.id === hit.id);

    if (!wall) {
      return;
    }

    const positionOnEdge = openingEdgeParamFromCenter(wall, [x, y]);
    dragRef.current = { wallId: wall.id, positionOnEdge };
    setProtrusionPlacement({ wallId: wall.id, positionOnEdge, widthM });
  }

  if (!enabled) {
    return null;
  }

  return (
    <g data-layer="protrusion-placement">
      <rect
        fill="transparent"
        height="100%"
        width="100%"
        style={{ cursor: "crosshair" }}
        onPointerDown={pickWall}
      />
      {previewFootprint.length >= 3 ? (
        <polygon
          fill="rgba(56,189,248,0.22)"
          points={polygonPoints(previewFootprint)}
          stroke="#38bdf8"
          strokeWidth="0.3"
        />
      ) : null}
      {previewWall && placement && hostRoom ? (
        <text
          fill="#94a3b8"
          fontSize="1"
          x={(previewWall.start[0] + previewWall.end[0]) / 2}
          y={(previewWall.start[1] + previewWall.end[1]) / 2 - 0.8}
        >
          {hostRoom.name} · {placement.widthM.toFixed(1)}m
        </text>
      ) : null}
    </g>
  );
}
