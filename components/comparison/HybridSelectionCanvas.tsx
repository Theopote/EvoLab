"use client";

import { useMemo } from "react";
import { getViewBox, polygonPoints, zoneColors, zoneStrokes } from "@/components/floor-plan/floor-plan-utils";
import { LabelLayer } from "@/components/floor-plan/layers/LabelLayer";
import { OutlineLayer } from "@/components/floor-plan/layers/OutlineLayer";
import type { PlanVersion, Room } from "@/lib/project-types";

interface HybridSelectionCanvasProps {
  version: PlanVersion;
  rooms: Room[];
  selectedRoomIds: Set<string>;
  accentClass: "accent" | "warning";
  onToggleRoom: (roomId: string) => void;
}

export function HybridSelectionCanvas({
  version,
  rooms,
  selectedRoomIds,
  accentClass,
  onToggleRoom
}: HybridSelectionCanvasProps) {
  const visibleVersion = useMemo(() => ({ ...version, rooms }), [rooms, version]);
  const strokeColor = accentClass === "accent" ? "#4fb5c8" : "#e6a23c";
  const fillSelected = accentClass === "accent" ? "rgba(79,181,200,0.42)" : "rgba(230,162,60,0.42)";

  return (
    <div className="relative overflow-hidden rounded border border-line bg-[#081018]">
      <svg className="h-[220px] w-full" viewBox={getViewBox(version)} role="img">
        <OutlineLayer version={version} />
        <g data-layer="hybrid-room-pick">
          {rooms.map((room) => {
            const isSelected = selectedRoomIds.has(room.id);

            return (
              <polygon
                key={room.id}
                points={polygonPoints(room.polygon)}
                fill={isSelected ? fillSelected : zoneColors[room.zone]}
                stroke={isSelected ? strokeColor : zoneStrokes[room.zone]}
                strokeWidth={isSelected ? "0.42" : "0.16"}
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleRoom(room.id);
                }}
              />
            );
          })}
        </g>
        <LabelLayer version={visibleVersion} />
      </svg>
      <div className="absolute bottom-2 left-2 rounded border border-line bg-[#081018]/90 px-2 py-1 text-[10px] text-muted">
        Click rooms to lock · {selectedRoomIds.size} selected
      </div>
    </div>
  );
}
