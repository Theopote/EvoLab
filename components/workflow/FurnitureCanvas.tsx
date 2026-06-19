"use client";

import { useMemo, useRef, useState } from "react";
import { GridLayer } from "@/components/floor-plan/layers/GridLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import { RoomFillLayer } from "@/components/floor-plan/layers/RoomFillLayer";
import { clientToSvgPoint, getViewBox } from "@/components/floor-plan/floor-plan-utils";
import { constrainFurniturePosition, roomPolygonForFurniture } from "@/lib/furniture-placement";
import type { FurnitureItem, FurnitureLayout } from "@/lib/building-domain";
import type { PlanVersion, Point, Room } from "@/lib/project-types";

const categoryTone: Record<FurnitureItem["category"], string> = {
  desk: "#38bdf8",
  chair: "#94a3b8",
  bed: "#a78bfa",
  table: "#34d399",
  sofa: "#fbbf24",
  equipment: "#fb923c"
};

interface FurnitureCanvasProps {
  version: PlanVersion;
  rooms: Room[];
  layout?: FurnitureLayout;
  levelId?: string;
  selectedItemId?: string;
  onSelectItem: (itemId?: string) => void;
  onMoveItem: (itemId: string, position: Point) => void;
}

interface DragSession {
  itemId: string;
  pointerId: number;
  roomId: string;
}

export function FurnitureCanvas({
  version,
  rooms,
  layout,
  levelId,
  selectedItemId,
  onSelectItem,
  onMoveItem
}: FurnitureCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragSessionRef = useRef<DragSession | null>(null);
  const [previewPositions, setPreviewPositions] = useState<Record<string, Point>>({});
  const [dragHint, setDragHint] = useState<string | null>(null);

  const items = useMemo(
    () => layout?.items.filter((item) => !levelId || item.levelId === levelId) ?? [],
    [layout, levelId]
  );

  function resolvePosition(item: FurnitureItem) {
    return previewPositions[item.id] ?? item.position;
  }

  function pointerToModel(event: React.PointerEvent): Point | null {
    const svg = svgRef.current;
    if (!svg) {
      return null;
    }

    return clientToSvgPoint(svg, event.clientX, event.clientY);
  }

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const item = items.find((entry) => entry.id === session.itemId);
    const roomPolygon = roomPolygonForFurniture(session.roomId, rooms);
    const point = pointerToModel(event);

    if (!item || !roomPolygon || !point) {
      return;
    }

    const next = constrainFurniturePosition(point, item, roomPolygon);

    if (!next) {
      setDragHint("Keep furniture inside its room");
      return;
    }

    setPreviewPositions((current) => ({ ...current, [item.id]: next }));
    setDragHint("Drag to reposition · release to commit");
  }

  function finishDrag(event: React.PointerEvent<SVGRectElement>) {
    const session = dragSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const preview = previewPositions[session.itemId];
    if (preview) {
      onMoveItem(session.itemId, preview);
    }

    dragSessionRef.current = null;
    setPreviewPositions({});
    setDragHint(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
      <div className="text-xs text-muted">
        {dragHint ?? "Drag furniture blocks to reposition within their host room."}
      </div>
      <div className="min-h-0 overflow-hidden rounded border border-line bg-[#0b1118]">
        <svg
          ref={svgRef}
          className="h-full min-h-[420px] w-full"
          viewBox={getViewBox(version)}
          onClick={() => onSelectItem(undefined)}
        >
          <OutlineLayer version={version} />
          <RoomFillLayer rooms={rooms} />
          <GridLayer version={version} />

          <g data-layer="furniture-overlay">
            {items.map((item) => {
              const position = resolvePosition(item);
              const isSelected = item.id === selectedItemId;
              const isPreview = Boolean(previewPositions[item.id]);
              const tone = categoryTone[item.category];

              return (
                <g
                  key={item.id}
                  transform={`rotate(${item.rotationDeg} ${position[0]} ${position[1]})`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectItem(item.id);
                  }}
                >
                  <rect
                    x={position[0] - item.width / 2}
                    y={position[1] - item.depth / 2}
                    width={item.width}
                    height={item.depth}
                    fill={`${tone}${isPreview ? "55" : "33"}`}
                    stroke={isSelected ? "#34d399" : tone}
                    strokeWidth={isSelected ? "0.18" : "0.1"}
                    rx="0.08"
                    style={{ cursor: "grab" }}
                    onPointerDown={(event) => {
                      dragSessionRef.current = {
                        itemId: item.id,
                        pointerId: event.pointerId,
                        roomId: item.roomId
                      };
                      onSelectItem(item.id);
                      setDragHint("Drag to reposition · release to commit");
                      event.currentTarget.setPointerCapture(event.pointerId);
                      event.stopPropagation();
                    }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishDrag}
                    onPointerCancel={() => {
                      dragSessionRef.current = null;
                      setPreviewPositions({});
                      setDragHint(null);
                    }}
                  />
                  <text
                    fill="#e2e8f0"
                    fontSize="0.9"
                    pointerEvents="none"
                    textAnchor="middle"
                    x={position[0]}
                    y={position[1] + 0.35}
                  >
                    {item.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
}
